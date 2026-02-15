import { injectable, inject } from 'tsyringe';
import { PaginatedBaseController } from '@shared/infrastructure/http/PaginatedBaseController';
import {
    ListTrajectorySceneArtifactsUseCase,
    type ListTrajectorySceneArtifactsInput
} from '@modules/trajectory/application/use-cases/scene-artifacts/ListTrajectorySceneArtifactsUseCase';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

@injectable()
export default class GetTrajectorySceneArtifactsController extends PaginatedBaseController<ListTrajectorySceneArtifactsUseCase> {
    constructor(
        @inject(ListTrajectorySceneArtifactsUseCase)
        useCase: ListTrajectorySceneArtifactsUseCase
    ) {
        super(useCase);
    }

    protected override getParams(req: AuthenticatedRequest): ListTrajectorySceneArtifactsInput {
        const params = super.getParams(req) as ListTrajectorySceneArtifactsInput & {
            type?: ListTrajectorySceneArtifactsInput['sourceType'];
        };

        const { type, sourceType, ...rest } = params;

        return {
            ...rest,
            sourceType: sourceType ?? type
        };
    }
}
