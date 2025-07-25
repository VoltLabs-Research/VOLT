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

import { Request, Response } from 'express';
import Team from '@models/team';
import User from '@models/user';
import HandlerFactory from '@/controllers/handler-factory';
import { ITeam } from '@types/models/team';
import { IUser } from '@types/models/user';
import { catchAsync } from '@utilities/runtime';

const factory = new HandlerFactory({
    model: Team,
    fields: ['name', 'description']
});

export const getTeamById = factory.getOne();
export const updateTeam = factory.updateOne();
export const deleteTeam = factory.deleteOne();

export const getUserTeams = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user.id;
    const teams = await Team.find({ members: userId })
        .populate('owner members', 'firstName lastName email')
        .sort({ createdAt: -1 });
        
    res.status(200).json({
        status: 'success',
        data: teams
    });
});

export const createTeam = async (req: Request, res: Response): Promise<void> => {
    const { name, description } = req.body;
    const owner = (req as any).user.id;
    if(!name){
        res.status(400).json({ status: 'error', data: { error: 'Team name is required.' } });
        return;
    }

    const newTeam = await Team.create({
        name,
        description,
        owner,
        members: [owner]
    });

    res.status(201).json({
        status: 'success',
        data: newTeam
    });
};