import type {
    GetParticleFilterUniqueValuesInputDTO,
    GetParticleFilterUniqueValuesOutputDTO
} from '@modules/trajectory/application/dtos/particle-filter';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { GetParticleFilterUniqueValuesUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetParticleFilterUniqueValuesUseCase';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

interface GetPublicCanvasParticleFilterUniqueValuesInput extends GetParticleFilterUniqueValuesInputDTO {
    userId?: string;
};

@Singleton()
export class GetPublicCanvasParticleFilterUniqueValuesUseCase implements IUseCase<
    GetPublicCanvasParticleFilterUniqueValuesInput,
    GetParticleFilterUniqueValuesOutputDTO,
    ApplicationError
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
        private readonly getParticleFilterUniqueValuesUseCase: GetParticleFilterUniqueValuesUseCase
    ) {}

    async execute(input: GetPublicCanvasParticleFilterUniqueValuesInput): Promise<Result<GetParticleFilterUniqueValuesOutputDTO, ApplicationError>> {
        try {
            await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

            const { userId: _userId, ...delegated } = input;

            return this.getParticleFilterUniqueValuesUseCase.execute(delegated);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
    }
};
