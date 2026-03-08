import { ErrorCodes } from '@core/constants/error-codes';
import { SYS_BUCKETS } from '@core/config/minio';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { v4 } from 'uuid';
import path from 'node:path';
import type { IStorageService } from '@shared/domain/port/IStorageService';

const storageService = container.resolve<IStorageService>(SHARED_TOKENS.StorageService);

export const uploadToStorage = async (req: Request, _res: Response, next: NextFunction) => {
    if(!req.file){
        throw ApplicationError.badRequest(
            ErrorCodes.FILE_READ_ERROR,
            'No file uploaded'
        );
    }

    const fileExtension = path.extname(req.file.originalname);
    const filename = `${v4()}${fileExtension}`;
    const objectKey = `chat-files/${filename}`;
    const fileMimeType = req.file.mimetype || 'application/octet-stream';

    if(!req.file.buffer?.length){
        throw ApplicationError.badRequest(
            ErrorCodes.FILE_READ_ERROR,
            'Uploaded file is empty or unreadable.'
        );
    }

    await storageService.upload(
        SYS_BUCKETS.CHAT,
        objectKey,
        req.file.buffer,
        { 'Content-Type': fileMimeType }
    );

    req.body.fileData = {
        filename: objectKey,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: fileMimeType,
        url: storageService.getPublicURL(SYS_BUCKETS.CHAT, objectKey)
    };

    next();
};
