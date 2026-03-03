import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IStorageService } from '@shared/domain/ports/IStorageService';
import { ErrorCodes } from '@core/constants/error-codes';
import { v4 } from 'uuid';
import path from 'node:path';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { SYS_BUCKETS } from '@core/config/minio';

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
    await storageService.upload(
        SYS_BUCKETS.CHAT,
        objectKey,
        req.file.buffer,
        { 'Content-Type': req.file.mimetype }
    );

    req.body.fileData = {
        filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: storageService.getPublicURL(SYS_BUCKETS.CHAT, objectKey)
    };

    next();
};
