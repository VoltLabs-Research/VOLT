import { ErrorCodes } from '@core/constants/error-codes';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';

const storage = multer.memoryStorage();
export const DEFAULT_TRAJECTORY_UPLOAD_DIR = path.resolve(process.cwd(), 'storage/temp/trajectory-uploads');
const trajectoryUploadDir = process.env.TRAJECTORY_UPLOAD_DIR || DEFAULT_TRAJECTORY_UPLOAD_DIR;
const CHAT_MAX_FILE_SIZE = 25 * 1024 * 1024;
const DEFAULT_TRAJECTORY_MAX_FILES = 10_000;

const parsePositiveInteger = (value: string | undefined, fallbackValue: number): number => {
    const parsedValue = Number.parseInt(value || '', 10);
    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
        return fallbackValue;
    }

    return parsedValue;
};

export const TRAJECTORY_MAX_FILES = parsePositiveInteger(
    process.env.TRAJECTORY_UPLOAD_MAX_FILES,
    DEFAULT_TRAJECTORY_MAX_FILES
);

const ensureDirectoryExists = (directoryPath: string): void => {
    fs.mkdirSync(directoryPath, { recursive: true });
};

const trajectoryUploadStorage = multer.diskStorage({
    destination: (_req, _file, callback) => {
        ensureDirectoryExists(trajectoryUploadDir);
        callback(null, trajectoryUploadDir);
    },
    filename: (_req, file, callback) => {
        const safeName = path.basename(file.originalname || 'trajectory-upload');
        const uniquePrefix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        callback(null, `${uniquePrefix}-${safeName}`);
    }
});

const resolveUploadErrorDetail = (error: unknown): string => {
    if (!(error instanceof Error)) {
        return 'Failed to process uploaded file.';
    }

    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EMFILE' || code === 'ENFILE') {
        return 'Too many files open on the server. Try uploading fewer files at once.';
    }

    if (code === 'ENOSPC') {
        return 'Server ran out of disk space during upload.';
    }

    if (error.message.includes('Aborted') || error.message.includes('aborted') || code === 'ECONNRESET') {
        return 'Upload was interrupted. Check your network connection and try again.';
    }

    return error.message || 'Failed to process uploaded file.';
};

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

    logger.error({ err: error }, '[Upload] Non-multer error during file upload');

    BaseResponse.error(
        response,
        resolveUploadErrorDetail(error),
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

export const uploadTrajectory = multer({
    storage: trajectoryUploadStorage,
    limits: {
        fields: 50,
        files: TRAJECTORY_MAX_FILES,
        fieldSize: 1024 * 1024
    }
});

export const uploadTrajectoryFiles = (fieldName: string) => (
    req: Request,
    response: Response,
    next: NextFunction
) => {
    req.setTimeout(0);

    uploadTrajectory.array(fieldName)(req, response, (error: unknown) => {
        if (!error) {
            return next();
        }

        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_COUNT') {
            return BaseResponse.error(
                response,
                `Trajectory upload supports up to ${TRAJECTORY_MAX_FILES} files per request.`,
                HttpStatus.BadRequest,
                ErrorCodes.TRAJECTORY_UPLOAD_FILE_LIMIT_EXCEEDED
            );
        }

        return createUploadErrorResponse(response, error);
    });
};

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
