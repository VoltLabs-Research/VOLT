import type {
    ListSceneArtifactsInputDTO,
    ListSceneArtifactsOutputDTO
} from '../../application/dtos/scene-artifacts';

export default interface ISceneArtifactRepository {
    listByTrajectory(params: ListSceneArtifactsInputDTO): Promise<ListSceneArtifactsOutputDTO>;
}
