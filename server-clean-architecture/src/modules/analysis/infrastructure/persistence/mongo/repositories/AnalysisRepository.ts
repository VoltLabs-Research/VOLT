import { IAnalysisRepository } from "@/src/modules/analysis/domain/port/IAnalysisRepository";
import Analysis, { AnalysisProps } from "@/src/modules/analysis/domain/entities/Analysis";
import AnalysisModel, { AnalysisDocument } from "../models/AnalysisModel";
import analysisMapper from "../mappers/AnalysisMapper";
import { MongooseBaseRepository } from "@/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository";
import { injectable } from "tsyringe";

@injectable()
export default class AnalysisRepository
    extends MongooseBaseRepository<Analysis, AnalysisProps, AnalysisDocument>
    implements IAnalysisRepository{

    constructor(){
        super(AnalysisModel, analysisMapper);
    }
    
    async retryFailedFrames(analysisId: string): Promise<void>{
    }
}