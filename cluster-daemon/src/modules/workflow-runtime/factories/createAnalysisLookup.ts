import { AnalysisModel, type AnalysisDocument } from '../models';

export interface AnalysisLookup {
    findById(analysisId: string): Promise<AnalysisDocument | null>;
}

export const createAnalysisLookup = (): AnalysisLookup => ({
    async findById(analysisId: string): Promise<AnalysisDocument | null> {
        return AnalysisModel.findById(analysisId).lean<AnalysisDocument | null>().exec();
    }
});
