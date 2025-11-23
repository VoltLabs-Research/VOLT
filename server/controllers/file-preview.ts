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

import { Request, Response, NextFunction } from 'express';
import { Chat, Message } from '@/models/index';
import RuntimeError from '@/utilities/runtime-error';
import { catchAsync } from '@/utilities/runtime';
import path from 'path';
import fs from 'fs';
import logger from '@/logger';

/**
 * Get file as base64 for preview
 */
export const getFileBase64 = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { chatId, messageId } = req.params;

    // Find the message
    const message = await Message.findOne({ _id: messageId, chat: chatId });
    if (!message) {
        throw new RuntimeError('Message::NotFound', 404);
    }

    if (message.messageType !== 'file' || !message.metadata?.filePath) {
        throw new RuntimeError('File::NotFound', 404);
    }

    try {
        const filePath = path.join(process.cwd(), 'storage', 'uploads', 'chat-files', message.metadata.filePath);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            throw new RuntimeError('File::NotFound', 404);
        }

        // Read file and convert to base64
        const fileBuffer = fs.readFileSync(filePath);
        const base64 = fileBuffer.toString('base64');
        const mimeType = message.metadata.fileType || 'application/octet-stream';
        const dataUrl = `data:${mimeType};base64,${base64}`;

        res.status(200).json({
            status: 'success',
            data: {
                dataUrl,
                fileName: message.metadata.fileName,
                fileType: message.metadata.fileType,
                fileSize: message.metadata.fileSize
            }
        });
    } catch (error) {
        logger.error(`Error reading file: ${error}`);
        throw new RuntimeError('File::ReadError', 500);
    }
});
