import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ErrorCodes } from '@core/constants/error-codes';
import BaseResponse from '@shared/infrastructure/http/BaseResponse';

const storage = multer.memoryStorage();
const CHAT_MAX_FILE_SIZE = 25 * 1024 * 1024;

const fileFilter = (_req: any, _file: Express.Multer.File, cb: any) => {
    cb(null, true);
};

export const upload = multer({
    storage,
    fileFilter
});

const chatUpload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: CHAT_MAX_FILE_SIZE,
        files: 1
    }
});

export const uploadChatSingleFile = (fieldName: string) => (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    chatUpload.single(fieldName)(req, _res, (error: unknown) => {
        if (!error) {
            return next();
        }

        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                return BaseResponse.error(
                    _res,
                    'File exceeds the 25MB upload limit.',
                    400,
                    ErrorCodes.FILE_READ_ERROR
                );
            }

            return BaseResponse.error(
                _res,
                error.message,
                400,
                ErrorCodes.FILE_READ_ERROR
            );
        }

        return BaseResponse.error(
            _res,
            'Failed to process uploaded file.',
            400,
            ErrorCodes.FILE_READ_ERROR
        );
    });
};