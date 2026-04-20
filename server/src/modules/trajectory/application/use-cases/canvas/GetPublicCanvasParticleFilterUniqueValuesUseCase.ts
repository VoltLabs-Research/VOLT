import { GetParticleFilterUniqueValuesUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetParticleFilterUniqueValuesUseCase';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type {
    GetParticleFilterUniqueValuesInputDTO,
    GetParticleFilterUniqueValuesOutputDTO
} from '@modules/trajectory/application/dtos/particle-filter';
import type { IUseCase } from '@shared/application/IUseCase';

interface GetPublicCanvasParticleFilterUniqueValuesInput extends GetParticleFilterUniqueValuesInputDTO {
    userId?: string;
};

@injectable()
export class GetPublicCanvasParticleFilterUniqueValuesUseCase implements IUseCase<
    GetPublicCanvasParticleFilterUniqueValuesInput,
    GetParticleFilterUniqueValuesOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TrajectoryReadAccessService)
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(GetParticleFilterUniqueValuesUseCase)
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
