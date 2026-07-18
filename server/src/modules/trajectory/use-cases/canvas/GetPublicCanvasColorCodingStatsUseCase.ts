import type {
    GetColorCodingStatsInputDTO,
    GetColorCodingStatsOutputDTO
} from '@modules/trajectory/dtos/color-coding';
import { TrajectoryReadAccessService } from '@modules/trajectory/services/TrajectoryReadAccessService';
import { GetColorCodingStatsUseCase } from '@modules/trajectory/use-cases/color-coding/GetColorCodingStatsUseCase';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';

interface GetPublicCanvasColorCodingStatsInput extends GetColorCodingStatsInputDTO {
    userId?: string;
};

@Singleton()
export class GetPublicCanvasColorCodingStatsUseCase implements IUseCase<
    GetPublicCanvasColorCodingStatsInput,
    GetColorCodingStatsOutputDTO
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
        private readonly getColorCodingStatsUseCase: GetColorCodingStatsUseCase
    ) {}

    async execute(input: GetPublicCanvasColorCodingStatsInput): Promise<GetColorCodingStatsOutputDTO> {
        await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

        const { userId: _userId, ...delegated } = input;

        return this.getColorCodingStatsUseCase.execute(delegated);
    }
};
