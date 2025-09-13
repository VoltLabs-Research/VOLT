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
import type { IAnalysisConfig } from '@/types/models/analysis-config';
import { IdentificationMode, LatticeStructure } from '@/types/services/opendxa';
import { Trajectory } from '@/models/index';
import useInverseRelations from '@/utilities/mongo/inverse-relations';
import useCascadeDelete from '@/utilities/mongo/cascade-delete';

const AnalysisConfigSchema: Schema<IAnalysisConfig> = new Schema({
    crystalStructure: {
        type: String,
        enum: Object.values(LatticeStructure),
        default: LatticeStructure.BCC
    },
    identificationMode: {
        type: String,
        enum: Object.values(IdentificationMode),
        default: IdentificationMode.CNA
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
    trajectory: {
        type: Schema.Types.ObjectId,
        ref: 'Trajectory',
        required: true,
        cascade: 'delete',
        inverse: { path: 'analysis', behavior: 'addToSet' } 
    },
    structureAnalysis: {
        type: Schema.Types.ObjectId,
        ref: 'StructureAnalysis',
        cascade: 'unset',
        inverse: { path: 'analysisConfig', behavior: 'set' }
    },
    simulationCell: {
        type: Schema.Types.ObjectId,
        ref: 'SimulationCell',
        cascade: 'unset',
        inverse: { path: 'analysisConfig', behavior: 'set' }
    },
    dislocations: [{
        type: Schema.Types.ObjectId,
        ref: 'Dislocation',
        cascade: 'pull',
        inverse: { path: 'analysisConfig', behavior: 'set' }
    }],
    structureIdentificationOnly: {
        type: Boolean,
        required: true
    }
}, {
    timestamps: true
});

AnalysisConfigSchema.plugin(useInverseRelations);
AnalysisConfigSchema.plugin(useCascadeDelete);

const AnalysisConfig: Model<IAnalysisConfig> = mongoose.model<IAnalysisConfig>('AnalysisConfig', AnalysisConfigSchema);

export default AnalysisConfig;