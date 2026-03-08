import { ErrorCodes } from '@core/constants/error-codes';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

const storage = multer.memoryStorage();
const CHAT_MAX_FILE_SIZE = 25 * 1024 * 1024;

const createUploadErrorResponse = (response: Response, error: unknown): void => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            BaseResponse.error(
                response,
                'File exceeds the allowed upload size.',
                HttpStatus.BadRequest,
                ErrorCodes.FILE_READ_ERROR
            );
            return;
        }

        BaseResponse.error(
            response,
            error.message,
            HttpStatus.BadRequest,
            ErrorCodes.FILE_READ_ERROR
        );
        return;
    }

    BaseResponse.error(
        response,
        'Failed to process uploaded file.',
        HttpStatus.BadRequest,
        ErrorCodes.FILE_READ_ERROR
    );
};

export const upload = multer({
    storage,
    limits: {
        fields: 50,
        files: 20,
        fieldSize: 1024 * 1024
    }
});

const chatUpload = multer({
    storage,
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

        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
            return BaseResponse.error(
                _res,
                'File exceeds the 25MB upload limit.',
                HttpStatus.BadRequest,
                ErrorCodes.FILE_READ_ERROR
            );
        }

        return createUploadErrorResponse(_res, error);
    });
};
