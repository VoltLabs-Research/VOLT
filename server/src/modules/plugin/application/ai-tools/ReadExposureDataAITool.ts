import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/application/di/TrajectoryTokens';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import { SHARED_TOKENS } from '@shared/application/di/SharedTokens';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import { SYS_BUCKETS } from '@core/config/minio';
import { decodeMultiStream } from '@shared/infrastructure/utilities/msgpack';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { buildExposurePayloadObjectName } from '@modules/plugin/infrastructure/utilities/analysis-file-collection';

const MAX_PAYLOAD_SIZE = 32768;

@injectable()
export class ReadExposureDataAITool extends AITool {
    readonly name = 'read_exposure_data';
    readonly description = 'Read raw exposure data (msgpack) from object storage for a specific analysis timestep.';
    readonly parameters = z.object({ trajectoryId: z.string(), analysisId: z.string(), exposureId: z.string(), timestep: z.number() });

    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository,
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const { trajectoryId, analysisId, exposureId, timestep } = params;
        const trajectory = await this.trajectoryRepo.findById(trajectoryId);
        if (!trajectory) throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');

        const objectName = buildExposurePayloadObjectName(
            trajectoryId,
            analysisId,
            exposureId,
            timestep
        );
        if (!(await this.storageService.exists(SYS_BUCKETS.PLUGINS, objectName))) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Exposure data not found');
        }

        const stream = await this.storageService.getStream(SYS_BUCKETS.PLUGINS, objectName);
        const decoded: unknown[] = [];
        for await (const value of decodeMultiStream(stream as any)) decoded.push(value);

        let payload: unknown = decoded.length === 1 ? decoded[0] : decoded;
        const serialized = JSON.stringify(payload);
        const truncated = serialized.length > MAX_PAYLOAD_SIZE;

        if (truncated) {
            payload = JSON.parse(serialized.substring(0, MAX_PAYLOAD_SIZE) + '..."truncated"');
        }

        return { summary: `Decoded exposure data for timestep ${timestep}.`, data: payload, truncated, originalSize: serialized.length };
    }
}
