/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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
 */

import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '@/utilities/runtime/runtime';
import { ApiToken } from '@/models/index';
import RuntimeError from '@/utilities/runtime/runtime-error';
import crypto from 'crypto';

export default class ApiTokenController {
    private readonly validPermissions = [
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

    public getMyApiTokens = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const user = (req as any).user;
        const tokens = await ApiToken.findByUser(user.id);

        res.status(200).json({
            status: 'success',
            results: tokens.length,
            data: tokens
        });
    });

    public createApiToken = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const user = (req as any).user;
        const { name, description, permissions, expiresAt } = req.body;

        if (permissions && !permissions.every((p: string) => this.validPermissions.includes(p))) {
            return next(new RuntimeError('ApiToken::InvalidPermissions', 400));
        }

        const tokenValue = `opendxa_${crypto.randomBytes(32).toString('hex')}`;
        const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');

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

        res.status(201).json({
            status: 'success',
            data: {
                ...token.toObject(),
                token: token.token
            }
        });
    });

    public getApiToken = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const user = (req as any).user;
        const { id } = req.params;

        const token = await ApiToken.findOne({ _id: id, createdBy: user.id });
        if (!token) return next(new RuntimeError('ApiToken::NotFound', 404));

        res.status(200).json({ status: 'success', data: token });
    });

    public updateApiToken = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const user = (req as any).user;
        const { id } = req.params;
        const { name, description, permissions, isActive } = req.body;

        const token = await ApiToken.findOne({ _id: id, createdBy: user.id });
        if (!token) return next(new RuntimeError('ApiToken::NotFound', 404));

        if (name !== undefined) token.name = name;
        if (description !== undefined) token.description = description;
        if (permissions !== undefined) {
            if (!permissions.every((p: string) => this.validPermissions.includes(p))) {
                return next(new RuntimeError('ApiToken::InvalidPermissions', 400));
            }
            token.permissions = permissions;
        }
        if (isActive !== undefined) token.isActive = isActive;

        await token.save();
        res.status(200).json({ status: 'success', data: token });
    });

    public deleteApiToken = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const user = (req as any).user;
        const { id } = req.params;

        const token = await ApiToken.findOne({ _id: id, createdBy: user.id });
        if (!token) return next(new RuntimeError('ApiToken::NotFound', 404));

        await ApiToken.findByIdAndDelete(id);
        res.status(204).json({ status: 'success', data: null });
    });

    public regenerateApiToken = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const user = (req as any).user;
        const { id } = req.params;

        const token = await ApiToken.findOne({ _id: id, createdBy: user.id });
        if (!token) return next(new RuntimeError('ApiToken::NotFound', 404));

        const newToken = `opendxa_${crypto.randomBytes(32).toString('hex')}`;
        token.token = newToken;
        token.tokenHash = crypto.createHash('sha256').update(newToken).digest('hex');

        await token.save();

        res.status(200).json({
            status: 'success',
            data: {
                ...token.toObject(),
                token: newToken
            }
        });
    });

    public validateApiToken = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(new RuntimeError('ApiToken::Required', 401));
        }

        const token = authHeader.substring(7);
        const apiToken = await ApiToken.findByToken(token);
        if (!apiToken) return next(new RuntimeError('ApiToken::Invalid', 401));
        if (!apiToken.isActive) return next(new RuntimeError('ApiToken::Inactive', 401));
        if (apiToken.isExpired()) return next(new RuntimeError('ApiToken::Expired', 401));

        await apiToken.updateLastUsed();
        (req as any).apiToken = apiToken;
        (req as any).user = { id: apiToken.createdBy };
        next();
    });

    public checkApiTokenPermission = (requiredPermission: string) => {
        return (req: Request, res: Response, next: NextFunction) => {
            const apiToken = (req as any).apiToken;
            if (!apiToken) return next(new RuntimeError('ApiToken::Required', 401));
            if (!apiToken.hasPermission(requiredPermission)) {
                return next(new RuntimeError('ApiToken::InsufficientPermissions', 403));
            }
            next();
        };
    };

    public getApiTokenStats = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

        res.status(200).json({
            status: 'success',
            data: stats[0] || {
                totalTokens: 0,
                activeTokens: 0,
                expiredTokens: 0,
                lastUsed: null
            }
        });
    });
}
