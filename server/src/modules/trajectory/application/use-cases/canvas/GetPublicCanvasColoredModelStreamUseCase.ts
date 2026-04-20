import { GetColoredModelStreamUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColoredModelStreamUseCase';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type { GetColoredModelStreamInputDTO } from '@modules/trajectory/application/dtos/color-coding';
import type { IUseCase } from '@shared/application/IUseCase';
import type { StreamableOutput } from '@shared/infrastructure/http/controllers/BaseStreamController';

interface GetPublicCanvasColoredModelStreamInput extends GetColoredModelStreamInputDTO {
    userId?: string;
};

@injectable()
export class GetPublicCanvasColoredModelStreamUseCase implements IUseCase<
    GetPublicCanvasColoredModelStreamInput,
    StreamableOutput,
    ApplicationError
> {
    constructor(
        @inject(TrajectoryReadAccessService)
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(GetColoredModelStreamUseCase)
        private readonly getColoredModelStreamUseCase: GetColoredModelStreamUseCase
    ) {}

    async execute(input: GetPublicCanvasColoredModelStreamInput): Promise<Result<StreamableOutput, ApplicationError>> {
        try {
            await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

            const { userId: _userId, ...delegated } = input;

            return this.getColoredModelStreamUseCase.execute(delegated);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
    }
};
