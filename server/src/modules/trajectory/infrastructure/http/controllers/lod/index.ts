import { createStreamController } from '@shared/infrastructure/http/controllers/createController';
import { GetOctreeMetadataStreamUseCase } from '@modules/trajectory/application/use-cases/lod/GetOctreeMetadataStreamUseCase';

const GetOctreeMetadataController = createStreamController(GetOctreeMetadataStreamUseCase);

export default {
    getOctreeMetadata: new GetOctreeMetadataController()
};
