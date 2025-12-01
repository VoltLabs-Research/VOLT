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
import { Team } from '@models/index';
import RuntimeError from '@/utilities/runtime-error';

export const checkTeamMembership = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const teamId = req.params.id;
    const userId = (req as any).user._id;

    const team = await Team.findOne({ _id: teamId, members: userId });

    if(!team){
        return next(new RuntimeError('Team::Membership::Forbidden', 403));
    }

    res.locals.team = team;

    next();
};

export const checkTeamOwnership = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const teamId = req.params.id;
    const userId = (req as any).user._id;
    
    const team = await Team.findOne({ _id: teamId, owner: userId });

    if(!team){
        return next(new RuntimeError('Team::Ownership::Forbidden', 403));
    }
    
    res.locals.team = team;

    next();
};