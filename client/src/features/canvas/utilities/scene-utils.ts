export const deepMerge = <T extends object>(base: T, patch: Partial<T>): T => {
    const out: any = Array.isArray(base) ? [...base] : { ...base };
    for (const key in patch) {
        const value: any = patch[key];
        if (value === undefined) continue;
        if (Array.isArray(value)) {
            out[key] = [...value];
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            out[key] = deepMerge((out[key] ?? {}) as any, value);
        } else {
            out[key] = value;
        }
    }

    return out;
};

export const formatSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    const value = bytes / Math.pow(1024, i)
    return `${value.toFixed(2).replace(/\.?0+$/, '')} ${units[i]}`
}

export const formatNumber = (n?: number) => {
    if (Number.isFinite(n)) {
        return new Intl.NumberFormat().format(n as number);
    }

    return '-';
};

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
        return `/plugins/${teamId}/glb/${trajectoryId}/${sceneAnalysisId}/${exposureId}/${currentTimestep}`;
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

    return `/trajectories/${teamId}/${trajectoryId}/${currentTimestep}/${analysisId}`;
};
