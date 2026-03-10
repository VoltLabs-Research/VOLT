import { ZodError, type ZodType } from 'zod';
import type { Request, Response } from 'express';

export const sendSuccess = <T>(res: Response, data: T, statusCode: number = 200): void => {
    res.status(statusCode).json({
        status: 'success',
        data
    });
};

export const sendError = (res: Response, error: unknown): void => {
    let message = 'Unexpected error';
    let statusCode = 400;

    if (error instanceof ZodError) {
        message = error.issues[0]?.message || 'Invalid request';
    } else if (error instanceof Error) {
        message = error.message;
    }

    res.status(statusCode).json({
        status: 'error',
        message
    });
};

export const parseValue = <T>(schema: ZodType<T>, value: unknown): T => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
        throw parsed.error;
    }

    return parsed.data;
};

export const copyHeaders = (sourceHeaders: Headers, res: Response): void => {
    sourceHeaders.forEach((value, key) => {
        if (key.toLowerCase() === 'transfer-encoding') {
            return;
        }

        res.setHeader(key, value);
    });
};

export const readProxyRequestBody = (req: Request): BodyInit | undefined => {
    if (req.method === 'GET' || req.method === 'HEAD') {
        return undefined;
    }

    if (typeof req.body === 'string') {
        return req.body;
    }

    if (Buffer.isBuffer(req.body)) {
        return new Uint8Array(req.body);
    }

    if (req.body && typeof req.body === 'object') {
        return JSON.stringify(req.body);
    }

    return undefined;
};
