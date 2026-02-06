interface PluginScene {
    source: 'plugin';
    analysisId: string;
    exposureId: string;
}

interface ColorCodingScene {
    source: 'color-coding';
    property: string;
    startValue: number;
    endValue: number;
    gradient: string;
    analysisId: string;
    exposureId?: string;
}

interface ParticleFilterScene {
    source: 'particle-filter';
    property: string;
    operator: string;
    value: number;
    analysisId?: string;
    exposureId?: string;
    action?: string;
}

export type ActiveScene = PluginScene | ColorCodingScene | ParticleFilterScene;

interface ComputeGlbUrlParams {
    teamId: string;
    trajectoryId: string;
    currentTimestep: number | undefined;
    analysisId: string;
    activeScene?: ActiveScene;
}

const buildPluginUrl = (
    teamId: string,
    trajectoryId: string,
    scene: PluginScene,
    timestep: number
): string | null => {
    const { analysisId, exposureId } = scene;
    if (!analysisId || !exposureId) return null;
    return `/plugin/${teamId}/exposure/glb/${trajectoryId}/${analysisId}/${exposureId}/${timestep}`;
};

const buildColorCodingUrl = (
    teamId: string,
    trajectoryId: string,
    scene: ColorCodingScene,
    timestep: number
): string => {
    const { property, startValue, endValue, gradient, analysisId, exposureId } = scene;
    const params = new URLSearchParams({
        property,
        startValue: String(startValue),
        endValue: String(endValue),
        gradient,
        timestep: String(timestep)
    });
    if (exposureId) params.set('exposureId', exposureId);
    return `/color-coding/${teamId}/${trajectoryId}/${analysisId}/?${params.toString()}`;
};

const buildParticleFilterUrl = (
    teamId: string,
    trajectoryId: string,
    scene: ParticleFilterScene,
    timestep: number
): string | null => {
    const { property, operator, value, analysisId, exposureId, action } = scene;
    if (!property || !operator || value === undefined) return null;

    const effectiveAnalysisId = analysisId || 'no-analysis';
    const params = new URLSearchParams({
        property,
        operator,
        value: String(value),
        timestep: String(timestep),
        action: action || 'delete'
    });
    if (exposureId) params.set('exposureId', exposureId);
    return `/particle-filter/${teamId}/${trajectoryId}/${effectiveAnalysisId}?${params.toString()}`;
};

export const computeGlbUrl = ({
    teamId,
    trajectoryId,
    currentTimestep,
    analysisId,
    activeScene
}: ComputeGlbUrlParams): string | null => {
    if (!trajectoryId || currentTimestep === undefined) return null;

    switch (activeScene?.source) {
        case 'plugin':
            return buildPluginUrl(teamId, trajectoryId, activeScene, currentTimestep);
        case 'color-coding':
            return buildColorCodingUrl(teamId, trajectoryId, activeScene, currentTimestep);
        case 'particle-filter':
            return buildParticleFilterUrl(teamId, trajectoryId, activeScene, currentTimestep);
        default:
            return `/trajectory/${teamId}/${trajectoryId}/${currentTimestep}/${analysisId}`;
    }
};
