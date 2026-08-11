import { ErrorCodes } from '@core/constants/error-codes';
import { getAnalysisRasterFramePNG, getRasterFramePNG } from '@modules/raster/services/raster-frames';
import { enqueueRasterization } from '@modules/raster/services/raster-jobs';
import { getRasterMetadata } from '@modules/raster/services/raster-metadata';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type {
    GetRasterMetadataInput,
    GetRasterMetadataOutput
} from '@shared/contracts/operations/GetRasterMetadata';
import type { DownloadStreamOutput } from '@shared/contracts/types/DownloadStream';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';

interface TriggerRasterizationInput {
    trajectoryId: string;
    teamId: string;
}

interface GetRasterFramePNGInput {
    trajectoryId: string;
    teamId: string;
    timestep: number;
    analysisId?: string;
    model?: string;
}

export default class RasterService {
    async triggerRasterization(input: TriggerRasterizationInput){
        const result = await enqueueRasterization(input.trajectoryId, input.teamId);

        if(result.queuedJobs === 0 && result.skippedJobs === 0){
            throw ApplicationError.notFound(
                ErrorCodes.RASTER_NOT_FOUND,
                'No rasterizable trajectory models were found in the team cluster storage'
            );
        }

        if(result.queuedJobs === 0 && result.duplicateJobs > 0){
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
    }

    async getRasterMetadata(input: GetRasterMetadataInput): Promise<GetRasterMetadataOutput>{
        return { metadata: await getRasterMetadata(input.trajectoryId, input.teamId) };
    }

    async getRasterFramePNG(input: GetRasterFramePNGInput): Promise<DownloadStreamOutput>{
        if((input.analysisId && !input.model) || (!input.analysisId && input.model)){
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'Analysis raster frame requests require both analysisId and model'
            );
        }

        const rasterFrame = input.analysisId && input.model
            ? await getAnalysisRasterFramePNG(
                input.trajectoryId,
                input.teamId,
                input.analysisId,
                input.timestep,
                input.model
            )
            : await getRasterFramePNG(
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
    }
}
