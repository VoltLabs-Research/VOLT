import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { SHARED_TOKENS } from '@/src/shared/infrastructure/di/SharedTokens';
import { IStorageService } from '@/src/shared/domain/ports/IStorageService';
import { ErrorCodes } from '@/src/core/constants/error-codes';
import { v4 } from 'uuid';
import path from 'node:path';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { SYS_BUCKETS } from '@/src/core/minio';

const storageService = container.resolve<IStorageService>(SHARED_TOKENS.StorageService);

export const uploadToStorage = async (req: Request, res: Response, next: NextFunction) => {
    if(!req.file){
        throw ApplicationError.badRequest(
            ErrorCodes.FILE_READ_ERROR,
            'No file uploaded'
        );
    }

    const fileExtension = path.extname(req.file.originalname);
    const objectName = `${v4()}${fileExtension}`;
    await storageService.upload(
        SYS_BUCKETS.CHAT,
        objectName,
        req.file.buffer,
        {
            originalName: req.file.originalname,
            mimeType: req.file.mimetype
        }
    );

    req.body.fileData = {
        filename: objectName,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
    };

    next();
};