import { listAnalysisFiles } from '@modules/plugin/utilities/exposure/analysis-file-collection';

import { ErrorCodes } from '@core/constants/error-codes';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { AITool } from '@shared/application/ai/AITool';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import type { IStorageService } from '@shared/domain/port/IStorageService';

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

        const rows = await listAnalysisFiles(this.storageService, trajectoryId, analysisId, {
            ignoreErrors: true
        });

        return { summary: `Found ${rows.length} files for analysis ${analysisId}.`, data: rows };
    }
};
