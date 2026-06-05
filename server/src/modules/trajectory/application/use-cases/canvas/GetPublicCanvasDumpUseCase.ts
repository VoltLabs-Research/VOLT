import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import type { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import { inject } from 'tsyringe';

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

        @inject(TRAJECTORY_TOKENS.TrajectoryDumpStorageService)
        private readonly trajectoryDumpStorageService: ITrajectoryDumpStorageService
    ) {}

    async execute(input: GetPublicCanvasDumpInput): Promise<Result<GetPublicCanvasDumpOutput, ApplicationError>> {
        try {
            await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

            const response = await this.trajectoryDumpStorageService.getDumpResponse(
                input.trajectoryId,
                input.timestep
            );

            const extraHeaders: Record<string, string> = {};

            if (response.contentEncoding) {
                extraHeaders['X-Volt-Resource-Encoding'] = response.contentEncoding;
            }

            return Result.ok(createDownloadStreamResponse({
                stream: response.stream,
                contentType: 'application/octet-stream',
                filename: response.contentEncoding === 'zstd'
                    ? `timestep-${input.timestep}.dump.zst`
                    : `timestep-${input.timestep}.dump`,
                disposition: 'inline',
                contentLength: response.contentLength,
                extraHeaders,
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
