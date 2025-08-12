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

import mongoose, { Schema, Model } from 'mongoose';

export interface IAnalysisConfig{
    crystalStructure: string;
    identificationMode: string;
    maxTrialCircuitSize: number;
    circuitStretchability: number;
    RMSD: number;
    defectMeshSmoothingLevel: number;
    lineSmoothingLevel: number;
    linePointInterval: number;
    onlyPerfectDislocations: boolean;
    markCoreAtoms: boolean;
    structureIdentificationOnly: boolean;
}

const AnalysisConfigSchema: Schema<IAnalysisConfig> = new Schema({
    crystalStructure: {
        type: String,
        required: true
    },
    identificationMode: {
        type: String,
        required: true
    },
    maxTrialCircuitSize: {
        type: Number,
        required: true
    },
    circuitStretchability: {
        type: Number,
        required: true
    },
    RMSD: {
        type: Number,
        required: true
    },
    defectMeshSmoothingLevel: {
        type: Number,
        required: true
    },
    lineSmoothingLevel: {
        type: Number,
        required: true
    },
    linePointInterval: {
        type: Number,
        required: true
    },
    onlyPerfectDislocations: {
        type: Boolean,
        required: true
    },
    markCoreAtoms: {
        type: Boolean,
        required: true
    },
    structureIdentificationOnly: {
        type: Boolean,
        required: true
    }
});

const AnalysisConfig: Model<IAnalysisConfig> = mongoose.model<IAnalysisConfig>('AnalysisConfig', AnalysisConfigSchema);

export default AnalysisConfig;