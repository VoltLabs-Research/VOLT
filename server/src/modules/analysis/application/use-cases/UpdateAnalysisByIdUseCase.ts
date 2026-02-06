import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { UpdateAnalysisInputDTO, UpdateAnalysisOutputDTO } from '@modules/analysis/application/dtos/UpdateAnalysisDTO';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';

@injectable()
export class UpdateAnalysisByIdUseCase implements IUseCase<UpdateAnalysisInputDTO, UpdateAnalysisOutputDTO> {
    constructor(
        @inject('IAnalysisRepository') private analysisRepository: IAnalysisRepository
    ){}

    async execute(input: UpdateAnalysisInputDTO): Promise<Result<UpdateAnalysisOutputDTO>> {
        const analysis = await this.analysisRepository.updateById(input.id, {
            config: input.config
        });

        if (!analysis) {
            return Result.fail(ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found'));
        }

        return Result.ok({
            analysis: {
                id: analysis.id,
                config: analysis.props.config,
                updatedAt: analysis.props.updatedAt || new Date()
            }
        });
    }
}
