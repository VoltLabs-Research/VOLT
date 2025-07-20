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

export interface User{
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'user' | 'admin';
    createdAt: string;
    updatedAt: string;
}

export interface BoxBounds{
    xlo: number;
    xhi: number;
    ylo: number;
    yhi: number;
    zlo: number;
    zhi: number;
}

export interface TimestepInfo{
    timestep: number;
    natoms: number;
    gltfPath: string;
    boxBounds: BoxBounds;
}

export interface TrajectoryStats{
    totalFiles: number;
    totalSize: number;
}

export interface Trajectory{
    _id: string;
    name: string;
    folderId: string;
    owner: User | string;
    sharedWith: (User | string)[];
    frames: TimestepInfo[];
    stats: TrajectoryStats;
    createdAt: string;
    updatedAt: string;
    users: (User | string)[];
}

export interface Notification{
    _id: string;
    recipient: User | string;
    title: string;
    content: string;
    read: boolean;
    link?: string;
    createdAt: string;
    updatedAt: string;
}

export interface AnalysisConfig {
    crystal_structure: 'FCC' | 'BCC' | 'HCP';
    identification_mode: 'PTM' | 'CNA';
    max_trial_circuit_size: number;
    circuit_stretchability: number;
    defect_mesh_smoothing_level: number;
    line_smoothing_level: number;
    line_point_interval: number;
    only_perfect_dislocations: boolean;
    mark_core_atoms: boolean;
}