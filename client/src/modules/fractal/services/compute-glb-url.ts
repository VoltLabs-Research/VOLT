import type {
    SceneObjectType,
    PluginScene,
    ColorCodingScene,
    ParticleFilterScene
} from '@/modules/fractal/api/entities/fractal';

export interface ComputeGlbUrlParams {
    teamId: string;
    trajectoryId: string;
    currentTimestep: number | undefined;
    analysisId: string;
    activeScene?: SceneObjectType;
}

const DEFAULT_ANALYSIS_ID = 'default';

const getApiBaseUrl = (): string => {
    const apiUrl = import.meta.env.VITE_API_URL;

    if (typeof apiUrl !== 'string' || apiUrl.trim().length === 0) {
        return '';
    }

    return apiUrl.replace(/\/$/, '');
};

const buildApiUrl = (path: string): string => {
    const apiBaseUrl = getApiBaseUrl();

    if (!apiBaseUrl) {
        return path;
    }

    return `${apiBaseUrl}${path}`;
};

const buildPluginUrl = (
    teamId: string,
    trajectoryId: string,
    scene: PluginScene,
    timestep: number
): string | null => {
    const { analysisId, exposureId } = scene;
    if (!analysisId || !exposureId) return null;
    return buildApiUrl(`/api/plugin/${teamId}/exposure/glb/${trajectoryId}/${analysisId}/${exposureId}/${timestep}`);
};

const buildColorCodingUrl = (
    teamId: string,
    trajectoryId: string,
    scene: ColorCodingScene,
    timestep: number
): string => {
    const { property, startValue, endValue, gradient, analysisId, exposureId } = scene;
    const effectiveAnalysisId = analysisId || DEFAULT_ANALYSIS_ID;
    const params = new URLSearchParams({
        property,
        startValue: String(startValue),
        endValue: String(endValue),
        gradient,
        timestep: String(timestep)
    });
    if (exposureId) params.set('exposureId', exposureId);
    return buildApiUrl(`/api/color-coding/${teamId}/${trajectoryId}/${effectiveAnalysisId}?${params.toString()}`);
};

const buildParticleFilterUrl = (
    teamId: string,
    trajectoryId: string,
    scene: ParticleFilterScene,
    timestep: number
): string | null => {
    const { property, operator, value, analysisId, exposureId, action } = scene;
    if (!property || !operator || value === undefined || !action) return null;

    const effectiveAnalysisId = analysisId || DEFAULT_ANALYSIS_ID;
    const params = new URLSearchParams({
        property,
        operator,
        value: String(value),
        timestep: String(timestep),
        action
    });
    if (exposureId) params.set('exposureId', exposureId);
    return buildApiUrl(`/api/particle-filter/${teamId}/${trajectoryId}/${effectiveAnalysisId}?${params.toString()}`);
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
            return buildApiUrl(`/api/trajectory/${teamId}/${trajectoryId}/${currentTimestep}/${analysisId}`);
    }
};
