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
    // Set default status code
    let statusCode = 500;
    let code: string | undefined;
    let message = err.message || 'Internal Server Error';

    // Check if it's a RuntimeError with status code
    if (err instanceof RuntimeError) {
        statusCode = err.statusCode || 500;
        const extractedCode = extractErrorCode(err);
        code = extractedCode || message;
    } else {
        // Try to extract code from regular Error message
        const extractedCode = extractErrorCode(err);
        code = extractedCode || message;
    }

    // Handle MongoDB validation errors
    if (err.name === 'ValidationError') {
        statusCode = 400;
        // Extract validation messages from MongoDB error
        const validationErrors = (err as any).errors || {};
        const errorMessages: string[] = [];
        
        for (const field in validationErrors) {
            const fieldError = validationErrors[field];
            // Use the validation message if available (set in schema validators)
            if (fieldError.message) {
                errorMessages.push(fieldError.message);
                // If this is the first error message and it looks like our error code format
                if (errorMessages.length === 1 && fieldError.message.includes('::')) {
                    code = fieldError.message;
                }
            }
        }
        
        message = errorMessages.join(', ') || 'Validation Error';
    }

    // Handle MongoDB duplicate key errors
    if (err.name === 'MongoServerError' && (err as any).code === 11000) {
        statusCode = 409;
        code = code || 'Database::DuplicateKey';
        message = 'A record with this value already exists';
    }

    // Handle MongoDB CastError
    if (err.name === 'CastError') {
        statusCode = 400;
        code = code || 'Database::InvalidId';
        message = 'Invalid ID format';
    }

    // Build response
    const errorResponse: any = {
        status: 'error',
        message,
        statusCode,
    };

    // Include error code in response
    if (code) {
        errorResponse.code = code;
    }

    // In development, include the full error
    if (process.env.NODE_ENV === 'development') {
        errorResponse.error = err;
        if ((err as any).stack) {
            errorResponse.stack = (err as any).stack;
        }
    }

    res.status(statusCode).json(errorResponse);
};
