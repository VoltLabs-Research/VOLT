import { ListTrajectorySceneArtifactsUseCase } from '@modules/trajectory/application/use-cases/scene-artifacts/ListTrajectorySceneArtifactsUseCase';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type { ListTrajectorySceneArtifactsInputDTO } from '@modules/trajectory/application/dtos/scene-artifacts/ListTrajectorySceneArtifactsDTO';
import type { IUseCase } from '@shared/application/IUseCase';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

interface ListPublicCanvasSceneArtifactsInput extends ListTrajectorySceneArtifactsInputDTO {
    userId?: string;
};

@injectable()
export class ListPublicCanvasSceneArtifactsUseCase implements IUseCase<
    ListPublicCanvasSceneArtifactsInput,
    PaginatedResult<unknown>,
    ApplicationError
> {
    constructor(
        @inject(TrajectoryReadAccessService)
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(ListTrajectorySceneArtifactsUseCase)
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
