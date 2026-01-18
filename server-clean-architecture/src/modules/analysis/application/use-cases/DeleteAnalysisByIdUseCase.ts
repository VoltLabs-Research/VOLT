import { Result } from '@shared/domain/ports/Result';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { injectable, inject } from 'tsyringe';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { DeleteAnalysisByIdInputDTO } from '@modules/analysis/application/dtos/DeleteAnalysisByIdDTO';

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