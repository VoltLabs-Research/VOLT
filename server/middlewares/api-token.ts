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
import ApiToken from '@/models/api-token';
import RuntimeError from '@/utilities/runtime-error';
import crypto from 'crypto';

/**
 * Middleware to validate API tokens
 * Can be used as an alternative to JWT authentication
 */
export const validateApiToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new RuntimeError('API token required', 401);
        }
        
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        
        // Find token by hash
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const apiToken = await ApiToken.findOne({ 
            tokenHash, 
            isActive: true 
        }).select('+tokenHash');
        
        if (!apiToken) {
            throw new RuntimeError('Invalid API token', 401);
        }
        
        if (apiToken.isExpired()) {
            throw new RuntimeError('API token has expired', 401);
        }
        
        // Update last used timestamp
        await apiToken.updateLastUsed();
        
        // Add token info to request
        (req as any).apiToken = apiToken;
        (req as any).user = { id: apiToken.createdBy };
        
        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Middleware to check if API token has specific permission
 */
export const requireApiTokenPermission = (requiredPermission: string) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const apiToken = (req as any).apiToken;
        
        if (!apiToken) {
            return next(new RuntimeError('API token required', 401));
        }
        
        if (!apiToken.hasPermission(requiredPermission)) {
            return next(new RuntimeError('Insufficient permissions', 403));
        }
        
        next();
    };
};

/**
 * Middleware to check if API token has any of the specified permissions
 */
export const requireAnyApiTokenPermission = (permissions: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const apiToken = (req as any).apiToken;
        
        if (!apiToken) {
            return next(new RuntimeError('API token required', 401));
        }
        
        const hasPermission = permissions.some(permission => 
            apiToken.hasPermission(permission)
        );
        
        if (!hasPermission) {
            return next(new RuntimeError('Insufficient permissions', 403));
        }
        
        next();
    };
};

/**
 * Middleware to check if API token has all of the specified permissions
 */
export const requireAllApiTokenPermissions = (permissions: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const apiToken = (req as any).apiToken;
        
        if (!apiToken) {
            return next(new RuntimeError('API token required', 401));
        }
        
        const hasAllPermissions = permissions.every(permission => 
            apiToken.hasPermission(permission)
        );
        
        if (!hasAllPermissions) {
            return next(new RuntimeError('Insufficient permissions', 403));
        }
        
        next();
    };
};

/**
 * Middleware to log API token usage
 */
export const logApiTokenUsage = (req: Request, res: Response, next: NextFunction): void => {
    const apiToken = (req as any).apiToken;
    
    if (apiToken) {
        console.log(`API Token ${apiToken.name} used for ${req.method} ${req.path}`);
    }
    
    next();
};
