import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { inject } from 'tsyringe';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import type { ListTeamSceneArtifactsInputDTO, ListTeamSceneArtifactsOutputDTO } from '@modules/trajectory/application/dtos/scene-artifacts/ListTeamSceneArtifactsDTO';
import type SceneArtifact from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import type { IUseCase } from '@shared/application/IUseCase';
import { injectable } from 'tsyringe';

const toOutput = (artifact: SceneArtifact) => ({
    _id: artifact._id,
    ...artifact.props
});

@injectable()
export class ListTeamSceneArtifactsUseCase implements IUseCase<ListTeamSceneArtifactsInputDTO, ListTeamSceneArtifactsOutputDTO> {
    constructor(
        
        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository) private readonly sceneArtifactRepository: ISceneArtifactRepository
    ) {}

    async execute(input: ListTeamSceneArtifactsInputDTO) {
        const result = await this.sceneArtifactRepository.findAllByTeamId(
            input.teamId,
            {
                page: input.page,
                limit: input.limit
            },
            {
                analysisId: input.analysisId,
                sourceType: input.sourceType,
                timestep: input.timestep
            }
        );

        return {
            ...result,
            data: result.data.map(toOutput)
        };
    }
};
