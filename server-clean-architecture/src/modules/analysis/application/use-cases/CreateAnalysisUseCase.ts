import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { CreateAnalysisInputDTO, CreateAnalysisOutputDTO } from '../dtos/CreateAnalysisDTO';
import { IAnalysisRepository } from '../../domain/port/IAnalysisRepository';

@injectable()
export class CreateAnalysisUseCase implements IUseCase<CreateAnalysisInputDTO, CreateAnalysisOutputDTO> {
    constructor(
        @inject('IAnalysisRepository') private analysisRepository: IAnalysisRepository
    ) { }

    async execute(input: CreateAnalysisInputDTO): Promise<Result<CreateAnalysisOutputDTO>> {
        const analysis = await this.analysisRepository.create({
            trajectory: input.trajectoryId,
            plugin: input.pluginSlug,
            config: input.config,
            createdBy: input.userId,
            team: input.teamId,
            totalFrames: 0,
            completedFrames: 0
        });

        return Result.ok({
            analysis: {
                id: analysis.id,
                trajectory: analysis.props.trajectory,
                plugin: analysis.props.plugin,
                config: analysis.props.config,
                status: 'pending', // Initial status
                createdAt: new Date()
            }
        });
    }
}
