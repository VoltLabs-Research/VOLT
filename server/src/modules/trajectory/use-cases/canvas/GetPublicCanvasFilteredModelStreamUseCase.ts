import type { GetFilteredModelStreamInputDTO } from '@modules/trajectory/dtos/particle-filter';
import { TrajectoryReadAccessService } from '@modules/trajectory/services/TrajectoryReadAccessService';
import { GetFilteredModelStreamUseCase } from '@modules/trajectory/use-cases/particle-filter/GetFilteredModelStreamUseCase';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import type { StreamableOutput } from '@shared/infrastructure/http/controllers/BaseStreamController';

interface GetPublicCanvasFilteredModelStreamInput extends GetFilteredModelStreamInputDTO {
    userId?: string;
};

@Singleton()
export class GetPublicCanvasFilteredModelStreamUseCase implements IUseCase<
    GetPublicCanvasFilteredModelStreamInput,
    StreamableOutput
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
        private readonly getFilteredModelStreamUseCase: GetFilteredModelStreamUseCase
    ) {}

    async execute(input: GetPublicCanvasFilteredModelStreamInput): Promise<StreamableOutput> {
        await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

        const { userId: _userId, ...delegated } = input;

        return this.getFilteredModelStreamUseCase.execute(delegated);
    }
};
