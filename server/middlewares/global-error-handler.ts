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
import RuntimeError from '@/utilities/runtime-error';

interface ErrorResponse {
    status: string;
    message: string;
    code?: string;
    statusCode: number;
}

/**
 * Extracts error code from error message (format: "Category::Subcategory::Type")
 * or uses the error message as the code if it's already in that format
 */
const extractErrorCode = (error: Error | RuntimeError): string | null => {
    const message = error.message || '';

    // If message contains :: separators, it's likely an error code
    if (message.includes('::')) {
        return message;
    }

    // Otherwise return null to use default handling
    return null;
};

/**
 * Global error handling middleware
 * Catches all errors thrown in route handlers and returns a standardized response
 */
export const globalErrorHandler = (
    err: Error | RuntimeError,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    // Default values
    let statusCode = 500;
    let code = 'Internal::Server::Error';
    let message = 'An unexpected error occurred';
    let details: any = undefined;

    // Handle RuntimeError
    if (err instanceof RuntimeError) {
        statusCode = err.statusCode;
        code = err.code;
        message = err.message;
    }
    // Handle Mongoose Validation Error
    else if (err.name === 'ValidationError') {
        statusCode = 400;
        code = 'Validation::Failed';
        message = 'Validation failed for one or more fields';

        const validationErrors = (err as any).errors || {};
        details = {};

        for (const field in validationErrors) {
            details[field] = validationErrors[field].message;
        }
    }
    // Handle Mongoose Duplicate Key Error
    else if (err.name === 'MongoServerError' && (err as any).code === 11000) {
        statusCode = 409;
        code = 'Database::DuplicateKey';
        message = 'A record with this value already exists';

        // Extract the duplicate field if possible
        const keyPattern = (err as any).keyPattern;
        if (keyPattern) {
            details = { field: Object.keys(keyPattern)[0] };
        }
    }
    // Handle Mongoose Cast Error (Invalid ID)
    else if (err.name === 'CastError') {
        statusCode = 400;
        code = 'Database::InvalidId';
        message = 'Invalid resource identifier format';
        details = {
            path: (err as any).path,
            value: (err as any).value
        };
    }
    // Handle JWT Errors
    else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        code = 'Auth::InvalidToken';
        message = 'Invalid authentication token';
    }
    else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        code = 'Auth::TokenExpired';
        message = 'Authentication token has expired';
    }
    // Handle generic Errors
    else {
        message = err.message || message;
    }

    // Build standardized response
    const response: any = {
        status: statusCode,
        code
    };

    if (details) {
        response.details = details;
    }

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
        response.rawError = err;
        // Keep message in dev for easier debugging
        response.message = message;
    }

    res.status(statusCode).json(response);
};
