/**
 * Scene source types for GLB URL generation.
 */
export type SceneSource = 'plugin' | 'color-coding' | 'particle-filter' | 'default';

/**
 * Parameters for plugin scene URL.
 */
export interface PluginSceneParams {
    source: 'plugin';
    analysisId: string;
    exposureId: string;
}

/**
 * Parameters for color-coding scene URL.
 */
export interface ColorCodingSceneParams {
    source: 'color-coding';
    property: string;
    startValue: number;
    endValue: number;
    gradient: string;
    analysisId: string;
    exposureId?: string;
}

/**
 * Parameters for particle-filter scene URL.
 */
export interface ParticleFilterSceneParams {
    source: 'particle-filter';
    property: string;
    operator: string;
    value: number;
    analysisId: string;
    exposureId?: string;
    action?: 'delete' | 'keep';
}

export type ActiveSceneParams = PluginSceneParams | ColorCodingSceneParams | ParticleFilterSceneParams | null;

/**
 * Computes the GLB URL for a trajectory visualization.
 * Pure function - deterministic, no side effects.
 *
 * @param teamId - Team identifier
 * @param trajectoryId - Trajectory identifier
 * @param currentTimestep - Current timestep number
 * @param analysisId - Analysis identifier
 * @param activeScene - Optional active scene parameters
 * @returns The computed URL or null if parameters are invalid
 */
export const computeGlbUrl = (
    teamId: string,
    trajectoryId: string,
    currentTimestep: number | undefined,
    analysisId: string,
    activeScene?: ActiveSceneParams
): string | null => {
    if (!trajectoryId || currentTimestep === undefined) return null;

    if (activeScene?.source === 'plugin') {
        const { analysisId: sceneAnalysisId, exposureId } = activeScene;
        if (!sceneAnalysisId || !exposureId) return null;
        return `/plugin/${teamId}/exposure/glb/${trajectoryId}/${sceneAnalysisId}/${exposureId}/${currentTimestep}`;
    }

    if (activeScene?.source === 'color-coding') {
        const { property, startValue, endValue, gradient, analysisId: sceneAnalysisId, exposureId } = activeScene;
        let url = `/color-coding/${teamId}/${trajectoryId}/${sceneAnalysisId}/?property=${property}&startValue=${startValue}&endValue=${endValue}&gradient=${gradient}&timestep=${currentTimestep}`;
        if (exposureId) url += `&exposureId=${exposureId}`;
        return url;
    }

    if (activeScene?.source === 'particle-filter') {
        const { property, operator, value, analysisId: sceneAnalysisId, exposureId, action } = activeScene;
        if (!sceneAnalysisId || !property || !operator || value === undefined) return null;
        let url = `/particle-filter/${teamId}/${trajectoryId}/${sceneAnalysisId}?property=${encodeURIComponent(property)}&operator=${encodeURIComponent(operator)}&value=${value}&timestep=${currentTimestep}&action=${action || 'delete'}`;
        if (exposureId) url += `&exposureId=${exposureId}`;
        return url;
    }

    return `/trajectory/${teamId}/${trajectoryId}/${currentTimestep}/${analysisId}`;
};

/**
 * Determines the scene source type from active scene parameters.
 * Pure function.
 */
export const getSceneSource = (activeScene?: ActiveSceneParams): SceneSource => {
    if (!activeScene) return 'default';
    return activeScene.source;
};
