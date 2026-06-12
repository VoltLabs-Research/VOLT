import { RASTER_CONTRACT_TOKENS } from '@shared/contracts/tokens';
import type { GetRasterMetadataOutputDTO } from '@shared/contracts/dtos';
import type { IGetRasterMetadataUseCase } from '@shared/contracts/ports';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

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

        @inject(RASTER_CONTRACT_TOKENS.GetRasterMetadataUseCase)
        private readonly getRasterMetadataUseCase: IGetRasterMetadataUseCase
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
