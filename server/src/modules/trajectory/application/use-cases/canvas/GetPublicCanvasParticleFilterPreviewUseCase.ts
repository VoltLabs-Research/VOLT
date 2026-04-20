import { PreviewParticleFilterUseCase } from '@modules/trajectory/application/use-cases/particle-filter/PreviewParticleFilterUseCase';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type {
    PreviewParticleFilterInputDTO,
    PreviewParticleFilterOutputDTO
} from '@modules/trajectory/application/dtos/particle-filter';
import type { IUseCase } from '@shared/application/IUseCase';

interface GetPublicCanvasParticleFilterPreviewInput extends PreviewParticleFilterInputDTO {
    userId?: string;
};

@injectable()
export class GetPublicCanvasParticleFilterPreviewUseCase implements IUseCase<
    GetPublicCanvasParticleFilterPreviewInput,
    PreviewParticleFilterOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TrajectoryReadAccessService)
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(PreviewParticleFilterUseCase)
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
