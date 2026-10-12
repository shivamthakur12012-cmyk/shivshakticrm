import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Document as DocModel } from '../models/Document';
import { ServiceCase } from '../models/ServiceCase';
import { storageService } from '../services/storage.service';

// Configure Multer memory storage
const storage = multer.memoryStorage();
export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // Limit to 10MB
});

// Upload Document for a ServiceCase Checklist Item
export async function uploadCaseDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { id: caseId, itemId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded.',
        errorCode: 'MISSING_FILE'
      });
    }

    // 1. Verify ServiceCase exists and matches tenant
    const serviceCase = await ServiceCase.findOne({ _id: caseId, organizationId: orgId });
    if (!serviceCase) {
      return res.status(404).json({
        success: false,
        message: 'Service case not found.',
        errorCode: 'CASE_NOT_FOUND'
      });
    }

    const item = (serviceCase.checklist || []).find((c: any) => (c._id || c.id)?.toString() === itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Checklist item slot not found.',
        errorCode: 'ITEM_NOT_FOUND'
      });
    }

    // 2. Upload file through storage service
    const storageKey = await storageService.uploadFile(req.file, `cases/${caseId}`);

    // 3. Create Document Registry record
    const doc = await DocModel.create({
      organizationId: orgId,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      storageKey,
      provider: process.env.STORAGE_PROVIDER === 's3' ? 's3' : 'local',
      caseId,
      customerId: serviceCase.customerId,
      uploadedBy: userId
    });

    // 4. Link Document back to ServiceCase checklist
    item.documentId = doc._id;
    item.status = 'submitted';
    item.uploadedAt = new Date();

    // If all required items are submitted, we can auto-advance stage to docs_received!
    const pendingRequired = (serviceCase.checklist || []).filter(
      c => c.isRequired && c.status === 'pending'
    );
    if (pendingRequired.length === 0 && serviceCase.stage === 'created') {
      serviceCase.stage = 'docs_received';
    }

    await serviceCase.save();

    return res.status(201).json({
      success: true,
      message: 'Document uploaded and linked successfully.',
      data: {
        document: doc,
        case: serviceCase
      }
    });
  } catch (error) {
    next(error);
  }
}

// Download/Stream file securely (guarantees tenant isolation)
export async function downloadDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;

    // 1. Fetch document and verify tenant
    const doc = await DocModel.findOne({ _id: id, organizationId: orgId });
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found or unauthorized access.',
        errorCode: 'NOT_FOUND'
      });
    }

    // 2. Resolve path on disk if provider is local
    if (doc.provider === 'local') {
      const uploadDir = path.resolve(__dirname, '../../uploads');
      const filePath = path.join(uploadDir, doc.storageKey);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: 'Physical file not found on disk.',
          errorCode: 'FILE_NOT_FOUND'
        });
      }

      // Serve download with proper headers
      res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName}"`);
      res.setHeader('Content-Type', doc.fileType);
      
      const fileStream = fs.createReadStream(filePath);
      return fileStream.pipe(res);
    } else {
      // For S3 or cloud providers, we redirect to signed URL
      const signedUrl = await storageService.getFileUrl(doc.storageKey);
      return res.redirect(signedUrl);
    }
  } catch (error) {
    next(error);
  }
}

// Delete Document
export async function deleteDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = req.organizationId;
    const { id } = req.params;

    const doc = await DocModel.findOne({ _id: id, organizationId: orgId });
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found.',
        errorCode: 'NOT_FOUND'
      });
    }

    // 1. Delete physical/cloud asset
    await storageService.deleteFile(doc.storageKey);

    // 2. Clear reference from ServiceCase checklist if linked
    if (doc.caseId) {
      const serviceCase = await ServiceCase.findOne({ _id: doc.caseId, organizationId: orgId });
      if (serviceCase) {
        const item = (serviceCase.checklist || []).find((c: any) => c.documentId?.toString() === (doc._id || doc.id)?.toString());
        if (item) {
          item.documentId = undefined;
          item.status = 'pending';
          item.uploadedAt = undefined;
          await serviceCase.save();
        }
      }
    }

    // 3. Delete DB record
    await DocModel.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: 'Document deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
}
