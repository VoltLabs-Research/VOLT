import type { GetRasterMetadataOutputDTO } from '@modules/raster/application/dtos/GetRasterMetadataDTO';
import { GetRasterMetadataUseCase } from '@modules/raster/application/use-cases/GetRasterMetadataUseCase';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

interface GetPublicCanvasRasterMetadataInput {
    trajectoryId: string;
    userId?: string;
};

@Singleton()
export class GetPublicCanvasRasterMetadataUseCase implements IUseCase<
    GetPublicCanvasRasterMetadataInput,
    GetRasterMetadataOutputDTO,
    ApplicationError
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
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
