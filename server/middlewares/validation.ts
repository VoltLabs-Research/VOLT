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
import { isValidObjectId } from 'mongoose';
import { Team } from '@/models/index';
import RuntimeError from '@/utilities/runtime/runtime-error';

/**
 * Middleware to validate MongoDB ObjectId from route params
 * @param paramName The name of the param to validate (defaults to 'id')
 */
export const validateObjectId = (paramName: string = 'id') => {
    return (req: Request, res: Response, next: NextFunction) => {
        const id = req.params[paramName];
        
        if (!id || !isValidObjectId(id)) {
            return next(new RuntimeError('InvalidObjectId', 400));
        }

        next();
    };
};

/**
 * Middleware to verify team membership by teamId in query or body
 */
export const verifyTeamMembershipByTeamId = async (req: Request, res: Response, next: NextFunction) => {
    const teamId = req.body.teamId || req.query.teamId || req.params.teamId;
    const userId = (req as any).user?._id || (req as any).user?.id;

    if (!userId) {
        return next(new RuntimeError('Unauthorized', 401));
    }

    if (!teamId) {
        return next(new RuntimeError('TeamIdRequired', 400));
    }

    if (!isValidObjectId(teamId)) {
        return next(new RuntimeError('InvalidTeamDocumentId', 400));
    }

    try {
        const team = await Team.findOne({ _id: teamId, members: userId });
        
        if (!team) {
            return next(new RuntimeError('Team::AccessDenied', 403));
        }

        res.locals.team = team;
        next();
    } catch (err: any) {
        return next(new RuntimeError('Team::LoadError', 500));
    }
};

/**
 * Middleware to validate required fields in request body
 * @param fields Array of required field names
 */
export const validateRequiredFields = (fields: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const missingFields = fields.filter(field => !req.body[field]);

        if (missingFields.length > 0) {
            return next(new RuntimeError(
                `MissingRequiredFields: ${missingFields.join(', ')}`,
                400
            ));
        }

        next();
    };
};

/**
 * Middleware to ensure user is authenticated
 * More semantic than protect middleware for internal use
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
        return next(new RuntimeError('Unauthorized', 401));
    }

    next();
};

/**
 * Generic middleware to load a resource and verify ownership
 * @param Model The Mongoose model
 * @param resourceName The name for error messages
 * @param ownerField The field name for the owner (default: 'createdBy')
 * @param localField The field name in res.locals to store the resource (default: lowercase resourceName)
 */
export const loadAndVerifyOwnership = (
    Model: any,
    resourceName: string,
    ownerField: string = 'createdBy',
    localField?: string
) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const userId = (req as any).user._id || (req as any).user.id;
        const { id } = req.params;

        try {
            const resource = await Model.findOne({ _id: id, [ownerField]: userId });

            if (!resource) {
                return next(new RuntimeError(`${resourceName}::NotFound`, 404));
            }

            const fieldName = localField || resourceName.toLowerCase();
            res.locals[fieldName] = resource;
            next();
        } catch (err: any) {
            return next(new RuntimeError(`${resourceName}::LoadError`, 500));
        }
    };
};
