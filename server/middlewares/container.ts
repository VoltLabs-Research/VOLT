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
import { Container, Team } from '@/models/index';
import RuntimeError from '@/utilities/runtime/runtime-error';

/**
 * Middleware to load container and verify user access
 * Checks both team membership and direct ownership
 */
export const loadAndVerifyContainerAccess = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = (req as any).user._id;

    try {
        const container = await Container.findById(id);
        
        if (!container) {
            return next(new RuntimeError('Container::NotFound', 404));
        }

        // Check access: either through team membership or direct ownership
        if (container.team) {
            const team = await Team.findOne({ _id: container.team, members: userId });
            if (!team) {
                return next(new RuntimeError('Container::AccessDenied', 403));
            }
            res.locals.team = team;
        } else if (container.createdBy.toString() !== userId.toString()) {
            return next(new RuntimeError('Container::AccessDenied', 403));
        }

        res.locals.container = container;
        next();
    } catch (err: any) {
        return next(new RuntimeError('Container::LoadError', 500));
    }
};

/**
 * Middleware to verify team membership for container creation
 */
export const verifyTeamForContainerCreation = async (req: Request, res: Response, next: NextFunction) => {
    const { teamId } = req.body;
    const userId = (req as any).user._id;

    if (!teamId) {
        return next(new RuntimeError('Container::TeamIdRequired', 400));
    }

    try {
        const team = await Team.findOne({ _id: teamId, members: userId });
        
        if (!team) {
            return next(new RuntimeError('Container::Team::AccessDenied', 403));
        }

        res.locals.team = team;
        next();
    } catch (err: any) {
        return next(new RuntimeError('Container::Team::LoadError', 500));
    }
};

/**
 * Middleware to validate container action
 */
export const validateContainerAction = (req: Request, res: Response, next: NextFunction) => {
    const { action } = req.body;

    if (!action || !['start', 'stop'].includes(action)) {
        return next(new RuntimeError('Container::InvalidAction', 400));
    }

    next();
};
