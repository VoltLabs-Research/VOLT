import {
    computeGlbUrl,
    type ActiveSceneParams
} from '../../domain/services/UrlBuilderService';

/**
 * Parameters for computing GLB URL.
 */
export interface ComputeGlbUrlParams {
    teamId: string;
    trajectoryId: string;
    currentTimestep: number | undefined;
    analysisId: string;
    activeScene?: ActiveSceneParams;
}

/**
 * Use case for computing GLB URLs.
 * Wraps the domain service for application layer usage.
 */
export class ComputeGlbUrlUseCase {
    /**
     * Computes the GLB URL for a trajectory visualization.
     *
     * @param params - Parameters for URL computation
     * @returns The computed URL or null if parameters are invalid
     */
    execute(params: ComputeGlbUrlParams): string | null {
        return computeGlbUrl(
            params.teamId,
            params.trajectoryId,
            params.currentTimestep,
            params.analysisId,
            params.activeScene
        );
    }

    /**
     * Validates if the parameters are sufficient for URL generation.
     */
    canCompute(params: Partial<ComputeGlbUrlParams>): boolean {
        return !!(
            params.teamId &&
            params.trajectoryId &&
            params.currentTimestep !== undefined &&
            params.analysisId
        );
    }
}
