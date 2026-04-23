import type { ListTrajectorySceneArtifactsInputDTO } from '@modules/trajectory/application/dtos/scene-artifacts/ListTrajectorySceneArtifactsDTO';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { ListTrajectorySceneArtifactsUseCase } from '@modules/trajectory/application/use-cases/scene-artifacts/ListTrajectorySceneArtifactsUseCase';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

interface ListPublicCanvasSceneArtifactsInput extends ListTrajectorySceneArtifactsInputDTO {
    userId?: string;
};

@Singleton()
export class ListPublicCanvasSceneArtifactsUseCase implements IUseCase<
    ListPublicCanvasSceneArtifactsInput,
    PaginatedResult<unknown>,
    ApplicationError
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
        private readonly listTrajectorySceneArtifactsUseCase: ListTrajectorySceneArtifactsUseCase
    ) {}

    async execute(input: ListPublicCanvasSceneArtifactsInput): Promise<Result<PaginatedResult<unknown>, ApplicationError>> {
        try {
            await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

            const { userId: _userId, ...delegated } = input;

            return this.listTrajectorySceneArtifactsUseCase.execute(delegated);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
    }
};
