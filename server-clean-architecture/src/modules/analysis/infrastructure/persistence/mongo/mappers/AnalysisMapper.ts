import Analysis, { AnalysisProps } from "@/src/modules/analysis/domain/entities/Analysis";
import { AnalysisDocument } from "../models/AnalysisModel";
import { BaseMapper } from "@/src/shared/infrastructure/persistence/mongo/MongoBaseMapper";

class AnalysisMapper extends BaseMapper<Analysis, AnalysisProps, AnalysisDocument>{
    constructor(){
        super(Analysis, [
            'createdBy',
            'trajectory'
        ]);
    }
};

export default new AnalysisMapper();