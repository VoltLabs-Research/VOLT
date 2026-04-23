import type { ListTeamSceneArtifactsInputDTO, ListTeamSceneArtifactsOutputDTO } from '@modules/trajectory/application/dtos/scene-artifacts/ListTeamSceneArtifactsDTO';
import type SceneArtifact from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import SceneArtifactRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/scene-artifacts/SceneArtifactRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

const toOutput = (artifact: SceneArtifact) => ({
    _id: artifact._id,
    ...artifact.props
});

@injectable()
export class ListTeamSceneArtifactsUseCase implements IUseCase<ListTeamSceneArtifactsInputDTO, ListTeamSceneArtifactsOutputDTO, ApplicationError> {
    constructor(
        
        private readonly sceneArtifactRepository: SceneArtifactRepository
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

        return Result.ok({
            ...result,
            data: result.data.map(toOutput)
        });
    }
};
