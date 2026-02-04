export const computeGlbUrl = (
    teamId: string,
    trajectoryId: string,
    currentTimestep: number | undefined,
    analysisId: string,
    activeScene?: any
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
        if (!property || !operator || value === undefined) return null;
        const effectiveAnalysisId = sceneAnalysisId || 'no-analysis';
        let url = `/particle-filter/${teamId}/${trajectoryId}/${effectiveAnalysisId}?property=${encodeURIComponent(property)}&operator=${encodeURIComponent(operator)}&value=${value}&timestep=${currentTimestep}&action=${action || 'delete'}`;
        if (exposureId) url += `&exposureId=${exposureId}`;
        return url;
    }

    return `/trajectory/${teamId}/${trajectoryId}/${currentTimestep}/${analysisId}`;
};
