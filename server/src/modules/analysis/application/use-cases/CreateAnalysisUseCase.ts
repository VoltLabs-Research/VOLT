import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import { CreateAnalysisInputDTO, CreateAnalysisOutputDTO } from '@modules/analysis/application/dtos/CreateAnalysisDTO';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';

@injectable()
export class CreateAnalysisUseCase implements IUseCase<CreateAnalysisInputDTO, CreateAnalysisOutputDTO> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository
    ) {}

    async execute(input: CreateAnalysisInputDTO): Promise<Result<CreateAnalysisOutputDTO>> {
        const analysis = await this.analysisRepository.create({
            trajectory: input.trajectoryId,
            plugin: input.pluginId,
            config: input.config,
            createdBy: input.userId,
            team: input.teamId,
            totalFrames: 0,
            completedFrames: 0
        });

        return Result.ok({
            analysis: {
                _id: analysis._id,
                trajectory: analysis.props.trajectory,
                plugin: analysis.props.plugin,
                config: analysis.props.config,
                status: 'pending',
                createdAt: new Date()
            }
        });
    }
};
