import { Result } from '@shared/domain/ports/Result';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { injectable, inject } from 'tsyringe';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { DeleteAnalysisByIdInputDTO } from '@modules/analysis/application/dtos/DeleteAnalysisByIdDTO';
import { GetAnalysisByIdInputDTO, GetAnalysisByIdOutputDTO } from '@modules/analysis/application/dtos/GetAnalysisByIdDTO';

@injectable()
export default class GetAnalysisByIdUseCase implements IUseCase<GetAnalysisByIdInputDTO, GetAnalysisByIdOutputDTO, ApplicationError>{
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private analysisRepo: IAnalysisRepository
    ){}

    async execute(input: GetAnalysisByIdInputDTO): Promise<Result<GetAnalysisByIdOutputDTO, ApplicationError>>{
        const { analysisId } = input;
        const result = await this.analysisRepo.findById(analysisId);
        if(!result){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                'Analysis not found'
            ));
        }

        return Result.ok(result.props);
    }
};