import { AnalysisModel, type AnalysisDocument } from '../models';

export const findAnalysisById = async (analysisId: string): Promise<AnalysisDocument | null> => {
    return AnalysisModel.findById(analysisId).lean<AnalysisDocument | null>().exec();
};

export type AnalysisRepository = {
    findById: typeof findAnalysisById;
};

export const analysisRepository: AnalysisRepository = {
    findById: findAnalysisById
};
