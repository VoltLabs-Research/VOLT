import { GetAtomsUseCase } from '@modules/trajectory/application/use-cases/trajectory/GetAtomsUseCase';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type { AtomRecord } from '@modules/trajectory/application/dtos/trajectory/GetAtomsDTO';
import type { IUseCase } from '@shared/application/IUseCase';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

interface GetPublicCanvasAtomsInput {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    page?: number;
    limit?: number;
    userId?: string;
};

@injectable()
export class GetPublicCanvasAtomsUseCase implements IUseCase<
    GetPublicCanvasAtomsInput,
    PaginatedResult<AtomRecord>,
    ApplicationError
> {
    constructor(
        @inject(TrajectoryReadAccessService)
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(GetAtomsUseCase)
        private readonly getAtomsUseCase: GetAtomsUseCase
    ) {}

    async execute(input: GetPublicCanvasAtomsInput): Promise<Result<PaginatedResult<AtomRecord>, ApplicationError>> {
        try {
            await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

            return this.getAtomsUseCase.execute({
                trajectoryId: input.trajectoryId,
                analysisId: input.analysisId,
                timestep: input.timestep,
                page: input.page,
                limit: input.limit
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
    }
};
