import type {
    GetParticleFilterPropertiesInputDTO,
    GetParticleFilterPropertiesOutputDTO
} from '@modules/trajectory/dtos/particle-filter';
import { TrajectoryReadAccessService } from '@modules/trajectory/services/TrajectoryReadAccessService';
import { GetParticleFilterPropertiesUseCase } from '@modules/trajectory/use-cases/particle-filter/GetParticleFilterPropertiesUseCase';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';

interface GetPublicCanvasParticleFilterPropertiesInput extends GetParticleFilterPropertiesInputDTO {
    userId?: string;
};

@Singleton()
export class GetPublicCanvasParticleFilterPropertiesUseCase implements IUseCase<
    GetPublicCanvasParticleFilterPropertiesInput,
    GetParticleFilterPropertiesOutputDTO
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
        private readonly getParticleFilterPropertiesUseCase: GetParticleFilterPropertiesUseCase
    ) {}

    async execute(input: GetPublicCanvasParticleFilterPropertiesInput): Promise<GetParticleFilterPropertiesOutputDTO> {
        await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

        const { userId: _userId, ...delegated } = input;

        return this.getParticleFilterPropertiesUseCase.execute(delegated);
    }
};
