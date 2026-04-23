import type {
    PreviewParticleFilterInputDTO,
    PreviewParticleFilterOutputDTO
} from '@modules/trajectory/application/dtos/particle-filter';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { PreviewParticleFilterUseCase } from '@modules/trajectory/application/use-cases/particle-filter/PreviewParticleFilterUseCase';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

interface GetPublicCanvasParticleFilterPreviewInput extends PreviewParticleFilterInputDTO {
    userId?: string;
};

@Singleton()
export class GetPublicCanvasParticleFilterPreviewUseCase implements IUseCase<
    GetPublicCanvasParticleFilterPreviewInput,
    PreviewParticleFilterOutputDTO,
    ApplicationError
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
        private readonly previewParticleFilterUseCase: PreviewParticleFilterUseCase
    ) {}

    async execute(input: GetPublicCanvasParticleFilterPreviewInput): Promise<Result<PreviewParticleFilterOutputDTO, ApplicationError>> {
        try {
            await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

            const { userId: _userId, ...delegated } = input;

            return this.previewParticleFilterUseCase.execute(delegated);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
    }
};
