/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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

import { ITeam } from '@types/models/team';
import { IUser } from '@/types/models/user';
import { IStructureAnalysis } from '@types/model/structureAnalysis';
import { ICellAnalysis } from '@/types/model/simulation-cell';
import { IAnalysis } from '@/models/trajectory/analysis';
import { Document, Types } from 'mongoose';

// Defines the limits of the simulation box on the three axes.
export interface IBoxBounds {
    xlo: number;
    xhi: number;
    ylo: number;
    yhi: number;
    zlo: number;
    zhi: number;
}

export interface ITimestepInfo {
    timestep: number;
    natoms: number;
    simulationCell: Types.ObjectId;
}

export interface ITrajectory extends Document {
    name: string;
    status: 'queued' | 'processing' | 'rendering' | 'completed' | 'failed';
    isPublic: boolean;
    team: ITeam;
    createdBy: IUser;
    rasterSceneViews: number;
    frames: ITimestepInfo[];
    analysis: IAnalysis[];
    preview: string;
    stats: {
        totalFiles: number;
        totalSize: number;
    };
    uploadId?: string;
    createdAt: Date;
    updatedAt: Date;
}
