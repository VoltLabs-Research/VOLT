import { Result } from "@/src/shared/domain/Result";
import { IUseCase } from "@/src/shared/application/IUseCase";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { injectable, inject } from 'tsyringe';
import { ANALYSIS_TOKENS } from "../../infrastructure/di/AnalysisTokens";
import { ErrorCodes } from "@/src/core/constants/error-codes";
import { IAnalysisRepository } from "../../domain/port/IAnalysisRepository";
import { DeleteAnalysisByIdInputDTO } from "../dtos/DeleteAnalysisByIdDTO";

@injectable()
export default class DeleteAnalysisByIdUseCase implements IUseCase<DeleteAnalysisByIdInputDTO, null, ApplicationError>{
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private analysisRepo: IAnalysisRepository
    ){}

    async execute(input: DeleteAnalysisByIdInputDTO): Promise<Result<null, ApplicationError>>{
        const { analysisId } = input;
        const result = await this.analysisRepo.deleteById(analysisId);
        if(!result){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                'Analysis not found'
            ));
        }

        return Result.ok(null);
    }
};