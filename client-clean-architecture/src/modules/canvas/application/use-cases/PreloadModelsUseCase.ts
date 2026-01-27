import type { ActiveSceneParams } from '../../domain/services/UrlBuilderService';
import type { IGlbPreloadRepository } from '../../domain/repositories/IGlbPreloadRepository';
import { ComputeGlbUrlUseCase } from './ComputeGlbUrlUseCase';

export interface PreloadModelsParams {
    teamId: string;
    trajectoryId: string;
    timesteps: number[];
    analysisId: string;
    activeScene?: ActiveSceneParams;
    startIndex?: number;
    limit?: number;
    onProgress?: (progress: number) => void;
}

export class PreloadModelsUseCase {
    constructor(
        private readonly glbPreloadRepository: IGlbPreloadRepository,
        private readonly computeGlbUrlUseCase: ComputeGlbUrlUseCase = new ComputeGlbUrlUseCase()
    ) {}

    async execute(params: PreloadModelsParams): Promise<Record<number, unknown>> {
        const {
            teamId,
            trajectoryId,
            timesteps,
            analysisId,
            activeScene,
            startIndex = 0,
            limit = timesteps.length,
            onProgress
        } = params;

        const endIndex = Math.min(startIndex + limit, timesteps.length);
        const targetTimesteps = timesteps.slice(startIndex, endIndex);
        const total = targetTimesteps.length;

        if (total === 0) {
            return {};
        }

        let loadedCount = 0;
        const results: Record<number, unknown> = {};

        await Promise.all(targetTimesteps.map(async (timestep) => {
            const url = this.computeGlbUrlUseCase.execute({
                teamId,
                trajectoryId,
                currentTimestep: timestep,
                analysisId,
                activeScene
            });

            if (!url) {
                loadedCount++;
                onProgress?.(loadedCount / total);
                return;
            }

            try {
                await this.glbPreloadRepository.preload(url);
                results[timestep] = true;
            } catch {
                // Ignore preload errors
            } finally {
                loadedCount++;
                onProgress?.(loadedCount / total);
            }
        }));

        return results;
    }
}
