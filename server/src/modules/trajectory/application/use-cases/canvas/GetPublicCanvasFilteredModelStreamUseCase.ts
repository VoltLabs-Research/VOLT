import { GetFilteredModelStreamUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetFilteredModelStreamUseCase';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type { GetFilteredModelStreamInputDTO } from '@modules/trajectory/application/dtos/particle-filter';
import type { IUseCase } from '@shared/application/IUseCase';
import type { StreamableOutput } from '@shared/infrastructure/http/controllers/BaseStreamController';

interface GetPublicCanvasFilteredModelStreamInput extends GetFilteredModelStreamInputDTO {
    userId?: string;
};

@injectable()
export class GetPublicCanvasFilteredModelStreamUseCase implements IUseCase<
    GetPublicCanvasFilteredModelStreamInput,
    StreamableOutput,
    ApplicationError
> {
    constructor(
        @inject(TrajectoryReadAccessService)
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(GetFilteredModelStreamUseCase)
        private readonly getFilteredModelStreamUseCase: GetFilteredModelStreamUseCase
    ) {}

    async execute(input: GetPublicCanvasFilteredModelStreamInput): Promise<Result<StreamableOutput, ApplicationError>> {
        try {
            await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

            const { userId: _userId, ...delegated } = input;

            return this.getFilteredModelStreamUseCase.execute(delegated);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
    }
};
