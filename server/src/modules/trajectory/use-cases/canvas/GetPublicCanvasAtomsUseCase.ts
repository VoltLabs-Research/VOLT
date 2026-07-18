import type { GetAtomsColumnarOutputDTO } from '@modules/trajectory/dtos/trajectory/GetAtomsDTO';
import { TrajectoryReadAccessService } from '@modules/trajectory/services/TrajectoryReadAccessService';
import { GetAtomsUseCase } from '@modules/trajectory/use-cases/trajectory/GetAtomsUseCase';
import type { IUseCase } from '@shared/application/IUseCase';
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
    GetAtomsColumnarOutputDTO
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
        private readonly getAtomsUseCase: GetAtomsUseCase
    ) {}

    async execute(input: GetPublicCanvasAtomsInput): Promise<GetAtomsColumnarOutputDTO> {
        await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

        return this.getAtomsUseCase.execute({
            trajectoryId: input.trajectoryId,
            analysisId: input.analysisId,
            timestep: input.timestep,
            page: input.page,
            limit: input.limit
        });
    }
};
