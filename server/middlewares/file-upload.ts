import multer from 'multer';
import path from 'path';
import storage from '@/services/storage';
import { v4 as uuidv4 } from 'uuid';
import { SYS_BUCKETS } from '@/config/minio';

// Use memory storage - files will be uploaded directly to MinIO
const memStorage = multer.memoryStorage();

// File filter for allowed types
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Allowed file types
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/zip',
        'application/x-zip-compressed',
        'application/x-rar-compressed',
        'video/mp4',
        'video/avi',
        'video/mov',
        'audio/mpeg',
        'audio/wav',
        'audio/mp3'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('File type not allowed'));
    }
};

// Configure multer
export const uploadFile = multer({
    storage: memStorage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
        files: 1 // Only one file at a time
    }
});

// Middleware for single file upload
export const uploadSingleFile = uploadFile.single('file');

/**
 * Upload file buffer to MinIO and return the object name
 * @param buffer File buffer from multer
 * @param originalName Original filename
 * @param mimetype File mime type
 * @returns MinIO object name
 */
export const uploadToMinIO = async (buffer: Buffer, originalName: string, mimetype: string): Promise<string> => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(originalName)}`;
    const objectName = `chat-files/${uniqueName}`;

    await storage.put(SYS_BUCKETS.CHAT, objectName, buffer, {
        'Content-Type': mimetype
    });

    return uniqueName;
};

// Helper function to get file URL(for backward compatibility)
export const getFileUrl = (filename: string) => {
    return `/api/chat/files/${filename}`;
};

// Helper function to get MinIO object name
export const getMinIOObjectName = (filename: string) => {
    return `chat-files/${filename}`;
};
