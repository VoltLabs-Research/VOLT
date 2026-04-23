import type { GetAtomsColumnarOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetAtomsDTO';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { GetAtomsUseCase } from '@modules/trajectory/application/use-cases/trajectory/GetAtomsUseCase';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

interface GetPublicCanvasAtomsInput {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    page?: number;
    limit?: number;
    userId?: string;
};

@Singleton()
export class GetPublicCanvasAtomsUseCase implements IUseCase<
    GetPublicCanvasAtomsInput,
    GetAtomsColumnarOutputDTO,
    ApplicationError
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
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
