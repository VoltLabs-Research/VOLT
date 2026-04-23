import type { GetFilteredModelStreamInputDTO } from '@modules/trajectory/application/dtos/particle-filter';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { GetFilteredModelStreamUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetFilteredModelStreamUseCase';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import type { StreamableOutput } from '@shared/infrastructure/http/controllers/BaseStreamController';

interface GetPublicCanvasFilteredModelStreamInput extends GetFilteredModelStreamInputDTO {
    userId?: string;
};

@Singleton()
export class GetPublicCanvasFilteredModelStreamUseCase implements IUseCase<
    GetPublicCanvasFilteredModelStreamInput,
    StreamableOutput,
    ApplicationError
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
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
