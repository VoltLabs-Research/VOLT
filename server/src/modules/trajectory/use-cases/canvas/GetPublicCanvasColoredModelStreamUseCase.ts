import type { GetColoredModelStreamInputDTO } from '@modules/trajectory/dtos/color-coding';
import { TrajectoryReadAccessService } from '@modules/trajectory/services/TrajectoryReadAccessService';
import { GetColoredModelStreamUseCase } from '@modules/trajectory/use-cases/color-coding/GetColoredModelStreamUseCase';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import type { StreamableOutput } from '@shared/infrastructure/http/controllers/BaseStreamController';

interface GetPublicCanvasColoredModelStreamInput extends GetColoredModelStreamInputDTO {
    userId?: string;
};

@Singleton()
export class GetPublicCanvasColoredModelStreamUseCase implements IUseCase<
    GetPublicCanvasColoredModelStreamInput,
    StreamableOutput
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
        private readonly getColoredModelStreamUseCase: GetColoredModelStreamUseCase
    ) {}

    async execute(input: GetPublicCanvasColoredModelStreamInput): Promise<StreamableOutput> {
        await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

        const { userId: _userId, ...delegated } = input;

        return this.getColoredModelStreamUseCase.execute(delegated);
    }
};
