import { Schema } from 'mongoose';
import type { ConfigParameters } from '@/types/services/opendxa';

export interface IAnalysisConfig extends ConfigParameters{
    // generated analysis with the saved config params
    structureAnalysis?: Schema.Types.ObjectId;
    simulationCell?: Schema.Types.ObjectId;
    dislocations?: Schema.Types.ObjectId;

    trajectory: Schema.Types.ObjectId
}