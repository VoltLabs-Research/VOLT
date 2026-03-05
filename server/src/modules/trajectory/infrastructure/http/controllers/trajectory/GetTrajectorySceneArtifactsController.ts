import { injectable, inject } from 'tsyringe';
import { PaginatedBaseController } from '@shared/infrastructure/http/PaginatedBaseController';
import {
    ListTrajectorySceneArtifactsUseCase
} from '@modules/trajectory/application/use-cases/scene-artifacts/ListTrajectorySceneArtifactsUseCase';
import type { ListTrajectorySceneArtifactsInputDTO } from '@modules/trajectory/application/dtos/scene-artifacts/ListTrajectorySceneArtifactsDTO';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

@injectable()
export default class GetTrajectorySceneArtifactsController extends PaginatedBaseController<ListTrajectorySceneArtifactsUseCase> {
    constructor(
        @inject(ListTrajectorySceneArtifactsUseCase)
        useCase: ListTrajectorySceneArtifactsUseCase
    ) {
        super(useCase);
    }

    protected override getParams(req: AuthenticatedRequest): ListTrajectorySceneArtifactsInputDTO {
        const params = super.getParams(req) as ListTrajectorySceneArtifactsInputDTO & {
            type?: ListTrajectorySceneArtifactsInputDTO['sourceType'];
        };

        const { type, sourceType, ...rest } = params;

        return {
            ...rest,
            sourceType: sourceType ?? type
        };
    }
}
