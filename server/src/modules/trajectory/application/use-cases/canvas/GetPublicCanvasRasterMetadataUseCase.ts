import { GetRasterMetadataUseCase } from '@modules/raster/application/use-cases/GetRasterMetadataUseCase';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type { GetRasterMetadataOutputDTO } from '@modules/raster/application/dtos/GetRasterMetadataDTO';
import type { IUseCase } from '@shared/application/IUseCase';

interface GetPublicCanvasRasterMetadataInput {
    trajectoryId: string;
    userId?: string;
};

@injectable()
export class GetPublicCanvasRasterMetadataUseCase implements IUseCase<
    GetPublicCanvasRasterMetadataInput,
    GetRasterMetadataOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TrajectoryReadAccessService)
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(GetRasterMetadataUseCase)
        private readonly getRasterMetadataUseCase: GetRasterMetadataUseCase
    ) {}

    async execute(input: GetPublicCanvasRasterMetadataInput): Promise<Result<GetRasterMetadataOutputDTO, ApplicationError>> {
        try {
            const trajectory = await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

            return this.getRasterMetadataUseCase.execute({
                trajectoryId: input.trajectoryId,
                teamId: String(trajectory.props.team)
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
    }
};
