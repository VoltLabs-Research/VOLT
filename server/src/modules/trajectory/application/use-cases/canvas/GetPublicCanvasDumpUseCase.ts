import { ErrorCodes } from '@core/constants/error-codes';
import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import TrajectoryDumpStorageService from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryDumpStorageService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';

interface GetPublicCanvasDumpInput {
    trajectoryId: string;
    timestep: string;
    userId?: string;
};

type GetPublicCanvasDumpOutput = DownloadStreamOutputDTO;

@Singleton()
export class GetPublicCanvasDumpUseCase implements IUseCase<
    GetPublicCanvasDumpInput,
    GetPublicCanvasDumpOutput,
    ApplicationError
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
        private readonly trajectoryDumpStorageService: TrajectoryDumpStorageService
    ) {}

    async execute(input: GetPublicCanvasDumpInput): Promise<Result<GetPublicCanvasDumpOutput, ApplicationError>> {
        try {
            await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

            const stream = await this.trajectoryDumpStorageService.getDumpStream(
                input.trajectoryId,
                input.timestep
            );

            return Result.ok(createDownloadStreamResponse({
                stream,
                contentType: 'application/octet-stream',
                filename: `timestep-${input.timestep}.dump`,
                disposition: 'inline',
                cacheControl: 'public, max-age=31536000, immutable'
            }));
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'Trajectory dump not found',
                404
            ));
        }
    }
};
