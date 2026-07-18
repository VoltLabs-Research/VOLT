import type { ListTrajectorySceneArtifactsInputDTO } from '@modules/trajectory/dtos/scene-artifacts/ListTrajectorySceneArtifactsDTO';
import { TrajectoryReadAccessService } from '@modules/trajectory/services/TrajectoryReadAccessService';
import { ListTrajectorySceneArtifactsUseCase } from '@modules/trajectory/use-cases/scene-artifacts/ListTrajectorySceneArtifactsUseCase';
import type { IUseCase } from '@shared/application/IUseCase';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { Singleton } from '@shared/infrastructure/di/decorators';

interface ListPublicCanvasSceneArtifactsInput extends ListTrajectorySceneArtifactsInputDTO {
    userId?: string;
};

@Singleton()
export class ListPublicCanvasSceneArtifactsUseCase implements IUseCase<
    ListPublicCanvasSceneArtifactsInput,
    PaginatedResult<unknown>
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
        private readonly listTrajectorySceneArtifactsUseCase: ListTrajectorySceneArtifactsUseCase
    ) {}

    async execute(input: ListPublicCanvasSceneArtifactsInput): Promise<PaginatedResult<unknown>> {
        await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

        const { userId: _userId, ...delegated } = input;

        return this.listTrajectorySceneArtifactsUseCase.execute(delegated);
    }
};
