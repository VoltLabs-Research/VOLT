/**
 * Copyright(c) 2025, Volt Authors. All rights reserved.
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

import { Document, Types } from 'mongoose';
import { IAnalysisConfig } from '@/types/models/analysis-config';

interface IPeriodicBoundaryConditions {
    x: boolean;
    y: boolean;
    z: boolean;
}

interface ILatticeAngles {
    alpha: number;
    beta: number;
    gamma: number;
}

interface IReciprocalLattice {
    matrix: number[][];
    volume: number;
}

interface IDimensionality {
    is_2d: boolean;
    effective_dimensions: number;
}

export interface ICellAnalysis extends Document {
    matrix: number[][];
    volume: number;
    periodicBoundaryConditions: IPeriodicBoundaryConditions;
    angles: ILatticeAngles;
    reciprocalLattice: IReciprocalLattice;
    dimensionality: IDimensionality;
    timestep: number;
    trajectory: Types.ObjectId;
    analysisConfig: Types.ObjectId;
}

export interface ISimulationCellGeometry {
    cell_vectors: number[][];
    cell_origin: number[];
    periodic_boundary_conditions: {
        x: boolean;
        y: boolean;
        z: boolean;
    };
}

export interface ISimulationCellBoundingBox {
    width: number;
    height: number;
    length: number;
}

export interface ISimulationCell extends Document {
    boundingBox: ISimulationCellBoundingBox;
    geometry: ISimulationCellGeometry;
    team: Types.ObjectId;
    trajectory: Types.ObjectId;
    timestep: number;
}
