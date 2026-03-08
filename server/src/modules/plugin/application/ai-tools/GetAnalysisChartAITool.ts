import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/application/di/TrajectoryTokens';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import { SHARED_TOKENS } from '@shared/application/di/SharedTokens';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import { SYS_BUCKETS } from '@core/config/minio';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';

@injectable()
export class GetAnalysisChartAITool extends AITool {
    readonly name = 'get_analysis_chart';
    readonly description = 'Retrieve a pre-generated chart image (PNG) from object storage.';
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

        const objectName = `trajectory-${trajectoryId}/analysis-${analysisId}/charts/${timestep}/${exposureId}.png`;
        if (!(await this.storageService.exists(SYS_BUCKETS.PLUGINS, objectName))) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Chart not found');
        }

        const buffer = await this.storageService.getBuffer(SYS_BUCKETS.PLUGINS, objectName);
        return { summary: `Retrieved chart for exposure "${exposureId}" at timestep ${timestep}.`, imageUrl: `data:image/png;base64,${buffer.toString('base64')}`, sizeBytes: buffer.length };
    }
}
