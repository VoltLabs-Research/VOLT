import { ErrorCodes } from '@core/constants/error-codes';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';
import type { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import type { IUseCase } from '@shared/application/IUseCase';

interface GetPublicCanvasDumpInput {
    trajectoryId: string;
    timestep: string;
    userId?: string;
};

type GetPublicCanvasDumpOutput = DownloadStreamOutputDTO;

@injectable()
export class GetPublicCanvasDumpUseCase implements IUseCase<
    GetPublicCanvasDumpInput,
    GetPublicCanvasDumpOutput,
    ApplicationError
> {
    constructor(
        @inject(TrajectoryReadAccessService)
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(TRAJECTORY_TOKENS.TrajectoryDumpStorageService)
        private readonly trajectoryDumpStorageService: ITrajectoryDumpStorageService
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
