import type {
    PreviewParticleFilterInputDTO,
    PreviewParticleFilterOutputDTO
} from '@modules/trajectory/dtos/particle-filter';
import { TrajectoryReadAccessService } from '@modules/trajectory/services/TrajectoryReadAccessService';
import { PreviewParticleFilterUseCase } from '@modules/trajectory/use-cases/particle-filter/PreviewParticleFilterUseCase';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';

interface GetPublicCanvasParticleFilterPreviewInput extends PreviewParticleFilterInputDTO {
    userId?: string;
};

@Singleton()
export class GetPublicCanvasParticleFilterPreviewUseCase implements IUseCase<
    GetPublicCanvasParticleFilterPreviewInput,
    PreviewParticleFilterOutputDTO
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
        private readonly previewParticleFilterUseCase: PreviewParticleFilterUseCase
    ) {}

    async execute(input: GetPublicCanvasParticleFilterPreviewInput): Promise<PreviewParticleFilterOutputDTO> {
        await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

        const { userId: _userId, ...delegated } = input;

        return this.previewParticleFilterUseCase.execute(delegated);
    }
};
