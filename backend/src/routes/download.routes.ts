import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

const ROOT_DIR = path.resolve(__dirname, '../../../');
const apkPath = path.join(ROOT_DIR, 'ArthoVista-CRM-Sync-v1.0.1-FIXED.apk');
const ipaPath = path.join(ROOT_DIR, 'ArthoVistaCRMSync.ipa');
const iosProjPath = path.join(ROOT_DIR, 'ArthoVistaCRMSync-iOS-Project.zip');

/**
 * Public direct download for Android APK
 */
router.get('/apk', (_req: Request, res: Response) => {
  if (!fs.existsSync(apkPath)) {
    return res.status(404).send('Android APK file not found on server.');
  }
  return res.download(apkPath, 'ArthoVista-CRM-Sync-v1.0.1-FIXED.apk');
});

/**
 * Public direct download for iOS IPA
 */
router.get('/ipa', (_req: Request, res: Response) => {
  if (!fs.existsSync(ipaPath)) {
    return res.status(404).send('iOS IPA file not found on server.');
  }
  return res.download(ipaPath, 'ArthoVistaCRMSync.ipa');
});

/**
 * Public direct download for iOS Full Xcode Project Zip
 */
router.get('/ios-project', (_req: Request, res: Response) => {
  if (!fs.existsSync(iosProjPath)) {
    return res.status(404).send('iOS Project package not found on server.');
  }
  return res.download(iosProjPath, 'ArthoVistaCRMSync-iOS-Project.zip');
});

export default router;
