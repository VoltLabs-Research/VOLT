import { PreloadScoreService, type PriorityModels } from '../../domain/services/PreloadScoreService';
import { FrameCacheKeyService } from '../../domain/services/FrameCacheKeyService';

/**
 * Preload task definition.
 */
export interface PreloadTask {
    timestep: number;
    analysisId: string;
    model: string;
    score: number;
}

/**
 * Analysis frame data.
 */
export interface AnalysisFrames {
    [timestep: string]: {
        availableModels: string[];
    };
}

/**
 * Preload parameters.
 */
export interface PreloadParams {
    analyses: Record<string, { frames: AnalysisFrames }>;
    existingCache: Record<string, any>;
    loadingFrames: Set<string>;
    priorityModels?: PriorityModels;
    currentTimestep?: number;
}

export interface PreloadExecutionOptions {
    onProgress?: (progress: number) => void;
    onFrameLoaded?: (task: PreloadTask, data: any | null, error?: unknown) => void;
    tasks?: PreloadTask[];
}

/**
 * Hardware detection interface.
 */
export interface IHardwareDetector {
    getConcurrency(): number;
}

/**
 * Frame loader interface.
 */
export interface IFrameLoader {
    loadFrame(
        trajectoryId: string,
        timestep: number,
        analysisId: string,
        model: string
    ): Promise<any>;
}

/**
 * Use case for preloading raster frames.
 * Orchestrates the preload process with proper priority and parallelization.
 */
export class PreloadFramesUseCase {
    private preloadScoreService = new PreloadScoreService();
    private cacheKeyService = new FrameCacheKeyService();

    constructor(
        private readonly frameLoader: IFrameLoader,
        private readonly hardwareDetector: IHardwareDetector
    ) {}

    /**
     * Executes the preload process.
     *
     * @param trajectoryId - Trajectory to preload frames for
     * @param params - Preload parameters
     * @param onProgress - Progress callback (0-100)
     */
    async execute(
        trajectoryId: string,
        params: PreloadParams,
        options: PreloadExecutionOptions = {}
    ): Promise<void> {
        const { onProgress, onFrameLoaded } = options;
        const tasks = options.tasks ?? this.buildTaskList(params);

        if (tasks.length === 0) {
            onProgress?.(100);
            return;
        }

        // Sort by priority
        const sortedTasks = this.preloadScoreService.sortByPriority(tasks);

        // Determine chunk size based on hardware
        const concurrency = this.hardwareDetector.getConcurrency();
        const chunkSize = this.calculateChunkSize(concurrency);

        // Execute in chunks
        await this.executeInChunks(
            trajectoryId,
            sortedTasks,
            chunkSize,
            onProgress,
            onFrameLoaded
        );
    }

    /**
     * Builds the list of tasks to preload.
     */
    buildTaskList(params: PreloadParams): PreloadTask[] {
        const { analyses, existingCache, loadingFrames, priorityModels, currentTimestep } = params;
        const tasks: PreloadTask[] = [];

        for (const analysisId of Object.keys(analyses)) {
            const frames = analyses[analysisId]?.frames || {};

            for (const timestepStr of Object.keys(frames)) {
                const timestep = parseInt(timestepStr, 10);
                if (!Number.isFinite(timestep)) continue;

                for (const model of frames[timestepStr]?.availableModels || []) {
                    // Skip preview model
                    if (model === 'preview') continue;

                    const key = this.cacheKeyService.generateKey(timestep, analysisId, model);

                    // Skip if already loading or cached
                    if (loadingFrames.has(key) || this.cacheKeyService.existsInCache(key, existingCache)) {
                        continue;
                    }

                    tasks.push({
                        timestep,
                        analysisId,
                        model,
                        score: this.preloadScoreService.calculateScore(
                            timestep,
                            model,
                            currentTimestep,
                            priorityModels
                        )
                    });
                }
            }
        }

        return tasks;
    }

    /**
     * Calculates optimal chunk size based on hardware.
     */
    private calculateChunkSize(concurrency: number): number {
        return Math.max(6, Math.min(16, concurrency));
    }

    /**
     * Executes tasks in parallel chunks.
     */
    private async executeInChunks(
        trajectoryId: string,
        tasks: PreloadTask[],
        chunkSize: number,
        onProgress?: (progress: number) => void,
        onFrameLoaded?: (task: PreloadTask, data: any | null, error?: unknown) => void
    ): Promise<void> {
        let completed = 0;

        for (let i = 0; i < tasks.length; i += chunkSize) {
            const chunk = tasks.slice(i, i + chunkSize);

            await Promise.all(chunk.map(async task => {
                let data: any | null = null;
                let error: unknown;
                try {
                    data = await this.frameLoader.loadFrame(
                        trajectoryId,
                        task.timestep,
                        task.analysisId,
                        task.model
                    );
                } catch (err) {
                    // Continue on error
                    error = err;
                } finally {
                    onFrameLoaded?.(task, data, error);
                    completed++;
                    onProgress?.(Math.round((completed / tasks.length) * 100));
                }
            }));
        }
    }
}
