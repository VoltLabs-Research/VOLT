import { injectable } from 'tsyringe';
import BaseRepository from '@/shared/infrastructure/repositories/BaseRepository';
import type ISceneArtifactRepository from '../../domain/ports/ISceneArtifactRepository';
import type {
    ListSceneArtifactsInputDTO,
    ListSceneArtifactsOutputDTO
} from '../../application/dtos/scene-artifacts';

@injectable()
export default class SceneArtifactRepository extends BaseRepository implements ISceneArtifactRepository {
    constructor() {
        super('/trajectory', { useRBAC: true });
    }

    async listByTrajectory(params: ListSceneArtifactsInputDTO): Promise<ListSceneArtifactsOutputDTO> {
        const { trajectoryId, type, sourceType, ...rest } = params;
        const query = {
            ...rest,
            ...(sourceType ? { sourceType } : {}),
            ...(!sourceType && type ? { sourceType: type } : {})
        };

        return this.client.get<ListSceneArtifactsOutputDTO>(`/${trajectoryId}/scene-artifacts`, query);
    }
}
