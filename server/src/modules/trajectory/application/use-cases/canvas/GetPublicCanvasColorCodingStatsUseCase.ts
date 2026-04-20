import { GetColorCodingStatsUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColorCodingStatsUseCase';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type {
    GetColorCodingStatsInputDTO,
    GetColorCodingStatsOutputDTO
} from '@modules/trajectory/application/dtos/color-coding';
import type { IUseCase } from '@shared/application/IUseCase';

interface GetPublicCanvasColorCodingStatsInput extends GetColorCodingStatsInputDTO {
    userId?: string;
};

@injectable()
export class GetPublicCanvasColorCodingStatsUseCase implements IUseCase<
    GetPublicCanvasColorCodingStatsInput,
    GetColorCodingStatsOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TrajectoryReadAccessService)
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(GetColorCodingStatsUseCase)
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
