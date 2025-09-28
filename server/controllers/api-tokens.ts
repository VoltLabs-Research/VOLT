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
import { catchAsync } from '@/utilities/runtime';
import { ApiToken } from '@/models/index';
import RuntimeError from '@/utilities/runtime-error';
import crypto from 'crypto';

/**
 * Get all API tokens for the authenticated user
 */
export const getMyApiTokens = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;
    
    const tokens = await ApiToken.findByUser(user.id);
    
    const response = {
        status: 'success',
        results: tokens.length,
        data: tokens
    };
    
    res.status(200).json(response);
});

/**
 * Create a new API token for the authenticated user
 */
export const createApiToken = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;
    const { name, description, permissions, expiresAt } = req.body;
    
    // Validate permissions
    const validPermissions = [
        'read:trajectories',
        'write:trajectories',
        'delete:trajectories',
        'read:analysis',
        'write:analysis',
        'delete:analysis',
        'read:teams',
        'write:teams',
        'admin:all'
    ];
    
    if (permissions && !permissions.every((p: string) => validPermissions.includes(p))) {
        return next(new RuntimeError('Invalid permissions provided', 400));
    }
    
    // Generate token
    const tokenValue = `opendxa_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');
    
    // Create token data
    const tokenData = {
        name,
        description,
        token: tokenValue,
        tokenHash,
        permissions: permissions || ['read:trajectories'],
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        createdBy: user.id
    };
    
    const token = await ApiToken.create(tokenData);
    
    // Return the token with the actual token value (only shown once)
    const response = {
        status: 'success',
        data: {
            ...token.toObject(),
            token: token.token // Include the actual token
        }
    };
    
    res.status(201).json(response);
});

/**
 * Get a specific API token by ID
 */
export const getApiToken = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;
    const { id } = req.params;
    
    const token = await ApiToken.findOne({ _id: id, createdBy: user.id });
    
    if (!token) {
        return next(new RuntimeError('API token not found', 404));
    }
    
    const response = {
        status: 'success',
        data: token
    };
    
    res.status(200).json(response);
});

/**
 * Update an API token
 */
export const updateApiToken = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;
    const { id } = req.params;
    const { name, description, permissions, isActive } = req.body;
    
    const token = await ApiToken.findOne({ _id: id, createdBy: user.id });
    
    if (!token) {
        return next(new RuntimeError('API token not found', 404));
    }
    
    // Update allowed fields
    if (name !== undefined) token.name = name;
    if (description !== undefined) token.description = description;
    if (permissions !== undefined) {
        const validPermissions = [
            'read:trajectories',
            'write:trajectories',
            'delete:trajectories',
            'read:analysis',
            'write:analysis',
            'delete:analysis',
            'read:teams',
            'write:teams',
            'admin:all'
        ];
        
        if (!permissions.every((p: string) => validPermissions.includes(p))) {
            return next(new RuntimeError('Invalid permissions provided', 400));
        }
        
        token.permissions = permissions;
    }
    if (isActive !== undefined) token.isActive = isActive;
    
    await token.save();
    
    const response = {
        status: 'success',
        data: token
    };
    
    res.status(200).json(response);
});

/**
 * Delete an API token
 */
export const deleteApiToken = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;
    const { id } = req.params;
    
    const token = await ApiToken.findOne({ _id: id, createdBy: user.id });
    
    if (!token) {
        return next(new RuntimeError('API token not found', 404));
    }
    
    await ApiToken.findByIdAndDelete(id);
    
    res.status(204).json({
        status: 'success',
        data: null
    });
});

/**
 * Regenerate an API token (creates new token, invalidates old one)
 */
export const regenerateApiToken = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;
    const { id } = req.params;
    
    const token = await ApiToken.findOne({ _id: id, createdBy: user.id });
    
    if (!token) {
        return next(new RuntimeError('API token not found', 404));
    }
    
    // Generate new token
    const newToken = `opendxa_${crypto.randomBytes(32).toString('hex')}`;
    token.token = newToken;
    token.tokenHash = crypto.createHash('sha256').update(newToken).digest('hex');
    
    await token.save();
    
    const response = {
        status: 'success',
        data: {
            ...token.toObject(),
            token: newToken // Include the new token
        }
    };
    
    res.status(200).json(response);
});

/**
 * Validate an API token (for middleware use)
 */
export const validateApiToken = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new RuntimeError('API token required', 401));
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const apiToken = await ApiToken.findByToken(token);
    
    if (!apiToken) {
        return next(new RuntimeError('Invalid API token', 401));
    }
    
    if (!apiToken.isActive) {
        return next(new RuntimeError('API token is inactive', 401));
    }
    
    if (apiToken.isExpired()) {
        return next(new RuntimeError('API token has expired', 401));
    }
    
    // Update last used timestamp
    await apiToken.updateLastUsed();
    
    // Add token info to request
    (req as any).apiToken = apiToken;
    (req as any).user = { id: apiToken.createdBy };
    
    next();
});

/**
 * Check if API token has specific permission
 */
export const checkApiTokenPermission = (requiredPermission: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
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
 * Get API token usage statistics
 */
export const getApiTokenStats = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;
    
    const stats = await ApiToken.aggregate([
        { $match: { createdBy: user._id } },
        {
            $group: {
                _id: null,
                totalTokens: { $sum: 1 },
                activeTokens: { $sum: { $cond: ['$isActive', 1, 0] } },
                expiredTokens: { $sum: { $cond: [{ $lt: ['$expiresAt', new Date()] }, 1, 0] } },
                lastUsed: { $max: '$lastUsedAt' }
            }
        }
    ]);
    
    const response = {
        status: 'success',
        data: stats[0] || {
            totalTokens: 0,
            activeTokens: 0,
            expiredTokens: 0,
            lastUsed: null
        }
    };
    
    res.status(200).json(response);
});
