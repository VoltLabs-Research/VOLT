import type {
    GetParticleFilterPropertiesInputDTO,
    GetParticleFilterPropertiesOutputDTO
} from '@modules/trajectory/application/dtos/particle-filter';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { GetParticleFilterPropertiesUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetParticleFilterPropertiesUseCase';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

interface GetPublicCanvasParticleFilterPropertiesInput extends GetParticleFilterPropertiesInputDTO {
    userId?: string;
};

@Singleton()
export class GetPublicCanvasParticleFilterPropertiesUseCase implements IUseCase<
    GetPublicCanvasParticleFilterPropertiesInput,
    GetParticleFilterPropertiesOutputDTO,
    ApplicationError
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
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
