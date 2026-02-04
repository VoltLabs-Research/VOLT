import { Request, Response, NextFunction, request } from 'express';
import { ApiTracker } from '@/models/index';
import logger from '@/logger';

/**
 * Extracts the real IP address from the request, considering various proxy headers.
 * @param req - Express request object.
 * @returns The real IP address.
 */
const getRealIp = (req: Request): string => {
    const forwardedFor = req.headers['x-forwarded-for'] as string;
    const realIp = req.headers['x-real-ip'] as string;
    const cfConnectingIp = req.headers['cf-connecting-ip'] as string;

    if(forwardedFor){
        // X-Forwarded-For can contain multiple IPs, take the first one.
        return forwardedFor.split(',')[0].trim();
    }

    if(realIp){
        return realIp;
    }

    if(cfConnectingIp){
        return cfConnectingIp;
    }

    // Fallback
    return req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1';
};

/**
 * Sanitizes sensitive data from request body and headers
 * @param data - Object to sanitize
 * @returns Sanitized object
 */
const sanitizeData = (data: any): any => {
    if(!data || typeof data !== 'object'){
        return data;
    }

    const sensitiveKeys = [
        'password',
        'token',
        'authorization',
        'cookie',
        'secret',
        'key',
        'apiKey',
        'accessToken',
        'refreshToken'
    ];

    const sanitized = { ...data };
    for(const key in sanitized){
        if(sensitiveKeys.some(sensitiveKey =>
            key.toLowerCase().includes(sensitiveKey.toLowerCase())
        )) {
            sanitized[key] = '[REDACTED]';
        }
    }

    return sanitized;
};

/**
 * Global API tracking middleware that logs all API requests.
 * This middleware should be applied early in the middleware stack.
 */
export const apiTracker = async(req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Store original end method to capture response time.
    const originalEnd = res.end;

    // Override res.end to capture responde details
    // @ts-ignore
    res.end = function(chunk?: any, encoding?: any){
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        const requestData = {
            method: req.method,
            url: req.originalUrl || req.url,
            userAgent: req.get('User-Agent'),
            ip: getRealIp(req),
            user: (req as any).user?._id,
            statusCode: res.statusCode,
            responseTime,
            requestBody: req.method !== 'GET' ? sanitizeData(req.body) : undefined,
            queryParams: Object.keys(req.query).length > 0 ? sanitizeData(req.query) : undefined,
            headers: sanitizeData({
                'content-type': req.get('Content-Type'),
                'accept': req.get('Accept'),
                'origin': req.get('Origin'),
                'referer': req.get('Referer')
            })
        };

        // Avoid blocking the response
        ApiTracker.create(requestData).catch((error) => {
            logger.error(`Failed to save API tracker data: ${error}`);
        });

        originalEnd.call(this, chunk, encoding);
    };

    next();
};
