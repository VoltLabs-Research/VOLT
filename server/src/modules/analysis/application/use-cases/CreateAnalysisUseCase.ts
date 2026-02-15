import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { CreateAnalysisInputDTO, CreateAnalysisOutputDTO } from '@modules/analysis/application/dtos/CreateAnalysisDTO';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';

@injectable()
export class CreateAnalysisUseCase implements IUseCase<CreateAnalysisInputDTO, CreateAnalysisOutputDTO> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository) private analysisRepository: IAnalysisRepository,
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository
    ){}

    async execute(input: CreateAnalysisInputDTO): Promise<Result<CreateAnalysisOutputDTO>> {
        const plugin = await this.pluginRepository.findOne({ slug: input.pluginSlug });
        if(!plugin){
            return Result.fail(ApplicationError.notFound(ErrorCodes.PLUGIN_NOT_FOUND, 'Plugin not found'));
        }

        const analysis = await this.analysisRepository.create({
            trajectory: input.trajectoryId,
            plugin: plugin.id,
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
