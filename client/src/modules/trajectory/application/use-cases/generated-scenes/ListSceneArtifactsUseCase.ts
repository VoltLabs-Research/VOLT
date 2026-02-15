import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type ISceneArtifactRepository from '@/modules/trajectory/domain/ports/ISceneArtifactRepository';
import type {
    ListSceneArtifactsInputDTO,
    ListSceneArtifactsOutputDTO
} from '@/modules/trajectory/application/dtos/scene-artifacts';
import { TRAJECTORY_TOKENS } from '@/modules/trajectory/infrastructure/di/tokens';

@injectable()
export default class ListSceneArtifactsUseCase
    implements IUseCase<ListSceneArtifactsInputDTO, ListSceneArtifactsOutputDTO> {
    constructor(
        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository)
        private readonly sceneArtifactRepository: ISceneArtifactRepository
    ) {}

    async execute(input: ListSceneArtifactsInputDTO): Promise<ListSceneArtifactsOutputDTO> {
        return this.sceneArtifactRepository.listByTrajectory(input);
    }
}
