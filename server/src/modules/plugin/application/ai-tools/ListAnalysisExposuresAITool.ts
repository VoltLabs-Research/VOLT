import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import { SYS_BUCKETS } from '@core/config/minio';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';

@injectable()
export class ListAnalysisExposuresAITool extends AITool {
    readonly name = 'list_analysis_exposures';
    readonly description = 'List all files (msgpack data, chart PNGs, GLB models) available for a specific analysis.';
    readonly parameters = z.object({ trajectoryId: z.string(), analysisId: z.string() });

    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository,
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const { trajectoryId, analysisId } = params;
        const trajectory = await this.trajectoryRepo.findById(trajectoryId);
        if (!trajectory) throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');

        const prefixes = [
            { bucket: SYS_BUCKETS.PLUGINS, prefix: `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/`, type: 'data' },
            { bucket: SYS_BUCKETS.PLUGINS, prefix: `trajectory-${trajectoryId}/analysis-${analysisId}/charts/`, type: 'chart' },
            { bucket: SYS_BUCKETS.MODELS, prefix: `trajectory-${trajectoryId}/analysis-${analysisId}/glb/`, type: 'model' }
        ];

        const rows: any[] = [];
        for (const { bucket, prefix, type } of prefixes) {
            try { 
                for await (const obj of this.storageService.listByPrefix(bucket, prefix, true)) { 
                    rows.push({ bucket, path: obj, type }); 
                } 
            } catch { 
                /* bucket may not exist */ 
            }
        }
        return { summary: `Found ${rows.length} files for analysis ${analysisId}.`, data: rows };
    }
}
