import { RASTER_CONTRACT_TOKENS } from '@shared/contracts/tokens';
import type { GetRasterMetadataOutputDTO } from '@shared/contracts/dtos';
import type { IGetRasterMetadataUseCase } from '@shared/contracts/ports';
import { TrajectoryReadAccessService } from '@modules/trajectory/services/TrajectoryReadAccessService';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

interface GetPublicCanvasRasterMetadataInput {
    trajectoryId: string;
    userId?: string;
};

@Singleton()
export class GetPublicCanvasRasterMetadataUseCase implements IUseCase<
    GetPublicCanvasRasterMetadataInput,
    GetRasterMetadataOutputDTO
> {
    constructor(

        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(RASTER_CONTRACT_TOKENS.GetRasterMetadataUseCase)
        private readonly getRasterMetadataUseCase: IGetRasterMetadataUseCase
    ) {}

    async execute(input: GetPublicCanvasRasterMetadataInput): Promise<GetRasterMetadataOutputDTO> {
        const trajectory = await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

        return this.getRasterMetadataUseCase.execute({
            trajectoryId: input.trajectoryId,
            teamId: String(trajectory.props.team)
        });
    }
};
