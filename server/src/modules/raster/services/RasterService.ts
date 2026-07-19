import teamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';
import { ErrorCodes } from '@core/constants/error-codes';
import { RasterFrameService } from '@modules/raster/services/RasterFrameService';
import { RasterJobEnqueuerService } from '@modules/raster/services/RasterJobEnqueuerService';
import { RasterMetadataService } from '@modules/raster/services/RasterMetadataService';
import { RasterStorageService } from '@modules/raster/services/RasterStorageService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type {
    GetRasterMetadataInput,
    GetRasterMetadataOutput
} from '@shared/contracts/operations/GetRasterMetadata';
import type { DownloadStreamOutput } from '@shared/contracts/types';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import daemonAnalysisCompletionService from '@modules/cluster/services/DaemonAnalysisCompletionService';
import objectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import type {
    IDaemonAnalysisCompletionService,
    ITeamClusterObjectGatewayClient
} from '@shared/contracts/ports';
import type TeamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';

interface TriggerRasterizationInput {
    trajectoryId: string;
    teamId: string;
}

interface TriggerRasterizationResult {
    trajectoryId: string;
    triggered: boolean;
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
    alreadyRasterizedJobs: number;
}

interface GetRasterFramePNGInput {
    trajectoryId: string;
    teamId: string;
    timestep: number;
    analysisId?: string;
    model?: string;
}

export default class RasterService {
    #objectGatewayClient: ITeamClusterObjectGatewayClient = objectGatewayClient;
    #frameReader = new RasterFrameService(
        new RasterStorageService(this.#objectGatewayClient)
    );
    #enqueuerCache?: RasterJobEnqueuerService;
    get #enqueuer(): RasterJobEnqueuerService {
        return (this.#enqueuerCache ??= new RasterJobEnqueuerService(
            teamClusterSelectionService,
            teamClusterDaemonClient,
            daemonAnalysisCompletionService
        ));
    }

    #metadata = new RasterMetadataService(
        new RasterStorageService(this.#objectGatewayClient)
    );

    async triggerRasterization(input: TriggerRasterizationInput): Promise<TriggerRasterizationResult> {
        try {
            const result = await this.#enqueuer.triggerRasterization(input.trajectoryId, input.teamId);

            if (result.queuedJobs === 0 && result.skippedJobs === 0) {
                throw ApplicationError.notFound(
                    ErrorCodes.RASTER_NOT_FOUND,
                    'No rasterizable trajectory models were found in the team cluster storage'
                );
            }

            if (result.queuedJobs === 0 && result.duplicateJobs > 0) {
                throw new ApplicationError(
                    ErrorCodes.RASTER_ALREADY_QUEUED,
                    'Equivalent rasterization jobs are already queued or running for this trajectory',
                    409
                );
            }

            return {
                trajectoryId: input.trajectoryId,
                triggered: result.queuedJobs > 0,
                queuedJobs: result.queuedJobs,
                duplicateJobs: result.duplicateJobs,
                skippedJobs: result.skippedJobs,
                alreadyRasterizedJobs: result.alreadyRasterizedJobs
            };
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to trigger rasterization',
                500
            );
        }
    }

    async getRasterMetadata(input: GetRasterMetadataInput): Promise<GetRasterMetadataOutput> {
        try {
            const metadata = await this.#metadata.getRasterMetadata(input.trajectoryId, input.teamId);

            return { metadata };
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to retrieve raster metadata',
                500
            );
        }
    }

    async getRasterFramePNG(input: GetRasterFramePNGInput): Promise<DownloadStreamOutput> {
        try {
            if ((input.analysisId && !input.model) || (!input.analysisId && input.model)) {
                throw ApplicationError.badRequest(
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    'Analysis raster frame requests require both analysisId and model'
                );
            }

            const rasterFrame = input.analysisId && input.model
                ? await this.#frameReader.getAnalysisRasterFramePNG(
                    input.trajectoryId,
                    input.teamId,
                    input.analysisId,
                    input.timestep,
                    input.model
                )
                : await this.#frameReader.getRasterFramePNG(
                    input.trajectoryId,
                    input.teamId,
                    input.timestep
                );

            return createDownloadStreamResponse({
                stream: rasterFrame.stream,
                contentType: rasterFrame.contentType,
                contentLength: rasterFrame.contentLength,
                cacheControl: rasterFrame.cacheControl,
                filename: rasterFrame.filename,
                disposition: 'inline'
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to retrieve raster frame PNG',
                500
            );
        }
    }
}
