import type {
    GetColorCodingStatsInputDTO,
    GetColorCodingStatsOutputDTO
} from '@modules/trajectory/application/dtos/color-coding';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { GetColorCodingStatsUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColorCodingStatsUseCase';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

interface GetPublicCanvasColorCodingStatsInput extends GetColorCodingStatsInputDTO {
    userId?: string;
};

@Singleton()
export class GetPublicCanvasColorCodingStatsUseCase implements IUseCase<
    GetPublicCanvasColorCodingStatsInput,
    GetColorCodingStatsOutputDTO,
    ApplicationError
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
        private readonly getColorCodingStatsUseCase: GetColorCodingStatsUseCase
    ) {}

    async execute(input: GetPublicCanvasColorCodingStatsInput): Promise<Result<GetColorCodingStatsOutputDTO, ApplicationError>> {
        try {
            await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

            const { userId: _userId, ...delegated } = input;

            return this.getColorCodingStatsUseCase.execute(delegated);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
    }
};
