import {Router, Response} from 'express';
import {mobileAuthMiddleware, MobileAuthRequest} from '../../middleware/mobileAuth';
import path from 'path';
import fs from 'fs';
import {generateId} from '../../utils/auth';

const router = Router();
const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'data', 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, {recursive: true});
}

// POST /api/media/upload
// Note: This is a basic implementation. In production, use multer or similar for multipart handling.
router.post('/upload', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    // For now, expect base64 data in body
    const {data, mimeType, filename} = req.body;

    if (!data || !mimeType) {
      res.status(400).json({success: false, error: {code: 'MISSING_FIELDS', message: 'data and mimeType required'}});
      return;
    }

    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024;
    const buffer = Buffer.from(data, 'base64');
    if (buffer.length > maxSize) {
      res.status(413).json({success: false, error: {code: 'FILE_TOO_LARGE', message: 'File exceeds 100MB limit'}});
      return;
    }

    // Validate mime type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/ogg', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'application/zip'];
    if (!allowedTypes.includes(mimeType)) {
      res.status(415).json({success: false, error: {code: 'UNSUPPORTED_TYPE', message: 'File type not supported'}});
      return;
    }

    const ext = mimeType.split('/')[1] || 'bin';
    const fileName = `${generateId()}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    fs.writeFileSync(filePath, buffer);

    const baseUrl = process.env.API_URL || `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/api/media/file/${fileName}`;

    res.json({
      success: true,
      data: {url, mimeType, fileSize: buffer.length, filename: filename || fileName},
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to upload file'}});
  }
});

// GET /api/media/file/:filename
router.get('/file/:filename', (req, res) => {
  try {
    const filePath = path.join(UPLOAD_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'File not found'}});
      return;
    }
    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to serve file'}});
  }
});

export default router;
