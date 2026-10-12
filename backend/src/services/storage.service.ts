import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

export interface StorageProvider {
  uploadFile(file: any, folder?: string): Promise<string>;
  deleteFile(key: string): Promise<void>;
  getFileUrl(key: string): Promise<string>;
}

// Local Disk Storage Provider Implementation
class LocalDiskStorageProvider implements StorageProvider {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.resolve(__dirname, '../../uploads');
    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(file: any, folder = 'documents'): Promise<string> {
    const folderPath = path.join(this.uploadDir, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    const destPath = path.join(folderPath, uniqueName);

    // Save file buffer to destination path
    await fs.promises.writeFile(destPath, file.buffer);
    
    // Return relative storage key path
    return `${folder}/${uniqueName}`;
  }

  async deleteFile(key: string): Promise<void> {
    const filePath = path.join(this.uploadDir, key);
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        logger.info(`Deleted file from disk: ${filePath}`);
      }
    } catch (err) {
      logger.error(`Failed to delete local file ${key}:`, err);
    }
  }

  async getFileUrl(key: string): Promise<string> {
    const hostUrl = process.env.APP_URL || 'http://localhost:5000';
    // Returns full download URL served statically by express
    return `${hostUrl}/uploads/${key}`;
  }
}

// Factory to select configured Storage Provider
class StorageServiceFactory {
  private provider: StorageProvider;

  constructor() {
    const providerType = process.env.STORAGE_PROVIDER || 'local';
    if (providerType === 's3') {
      // In production, we'd load S3StorageProvider. For development, we fall back.
      logger.info('S3 Storage Provider requested. Initializing local fallback.');
      this.provider = new LocalDiskStorageProvider();
    } else {
      logger.info('Initializing Local Disk Storage Provider.');
      this.provider = new LocalDiskStorageProvider();
    }
  }

  getProvider(): StorageProvider {
    return this.provider;
  }
}

export const storageService = new StorageServiceFactory().getProvider();
