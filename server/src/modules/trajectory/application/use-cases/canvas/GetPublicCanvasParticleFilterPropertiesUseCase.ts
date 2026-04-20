import { GetParticleFilterPropertiesUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetParticleFilterPropertiesUseCase';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type {
    GetParticleFilterPropertiesInputDTO,
    GetParticleFilterPropertiesOutputDTO
} from '@modules/trajectory/application/dtos/particle-filter';
import type { IUseCase } from '@shared/application/IUseCase';

interface GetPublicCanvasParticleFilterPropertiesInput extends GetParticleFilterPropertiesInputDTO {
    userId?: string;
};

@injectable()
export class GetPublicCanvasParticleFilterPropertiesUseCase implements IUseCase<
    GetPublicCanvasParticleFilterPropertiesInput,
    GetParticleFilterPropertiesOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TrajectoryReadAccessService)
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(GetParticleFilterPropertiesUseCase)
        private readonly getParticleFilterPropertiesUseCase: GetParticleFilterPropertiesUseCase
    ) {}

    async execute(input: GetPublicCanvasParticleFilterPropertiesInput): Promise<Result<GetParticleFilterPropertiesOutputDTO, ApplicationError>> {
        try {
            await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

            const { userId: _userId, ...delegated } = input;

            return this.getParticleFilterPropertiesUseCase.execute(delegated);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
    }
};
