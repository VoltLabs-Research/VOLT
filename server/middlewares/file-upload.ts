/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { putObject } from '@/utilities/buckets';
import { SYS_BUCKETS } from '@/config/minio';

// Use memory storage - files will be uploaded directly to MinIO
const storage = multer.memoryStorage();

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
    storage,
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

    await putObject(objectName, SYS_BUCKETS.PLUGINS, buffer, {
        'Content-Type': mimetype
    });

    return uniqueName;
};

// Helper function to get file URL (for backward compatibility)
export const getFileUrl = (filename: string) => {
    return `/api/chat/files/${filename}`;
};

// Helper function to get MinIO object name
export const getMinIOObjectName = (filename: string) => {
    return `chat-files/${filename}`;
};
