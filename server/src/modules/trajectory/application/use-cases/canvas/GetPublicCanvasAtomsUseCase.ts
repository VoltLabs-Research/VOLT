import { GetAtomsUseCase } from '@modules/trajectory/application/use-cases/trajectory/GetAtomsUseCase';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type { GetAtomsColumnarOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetAtomsDTO';
import type { IUseCase } from '@shared/application/IUseCase';

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
    GetAtomsColumnarOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TrajectoryReadAccessService)
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(GetAtomsUseCase)
        private readonly getAtomsUseCase: GetAtomsUseCase
    ) {}

    async execute(input: GetPublicCanvasAtomsInput): Promise<Result<GetAtomsColumnarOutputDTO, ApplicationError>> {
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
