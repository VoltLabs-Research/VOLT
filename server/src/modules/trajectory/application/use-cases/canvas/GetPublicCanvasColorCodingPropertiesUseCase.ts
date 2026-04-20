import { GetColorCodingPropertiesUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColorCodingPropertiesUseCase';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type {
    GetColorCodingPropertiesInputDTO,
    GetColorCodingPropertiesOutputDTO
} from '@modules/trajectory/application/dtos/color-coding';
import type { IUseCase } from '@shared/application/IUseCase';

interface GetPublicCanvasColorCodingPropertiesInput extends GetColorCodingPropertiesInputDTO {
    userId?: string;
};

@injectable()
export class GetPublicCanvasColorCodingPropertiesUseCase implements IUseCase<
    GetPublicCanvasColorCodingPropertiesInput,
    GetColorCodingPropertiesOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TrajectoryReadAccessService)
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(GetColorCodingPropertiesUseCase)
        private readonly getColorCodingPropertiesUseCase: GetColorCodingPropertiesUseCase
    ) {}

    async execute(input: GetPublicCanvasColorCodingPropertiesInput): Promise<Result<GetColorCodingPropertiesOutputDTO, ApplicationError>> {
        try {
            await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

            const { userId: _userId, ...delegated } = input;

            return this.getColorCodingPropertiesUseCase.execute(delegated);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
    }
};
