import { buildBackendUrl } from '@/app/core/http/utilities/backend-origin';
import type {
    SceneObjectType,
    PluginScene,
    ColorCodingScene,
    ParticleFilterScene
} from '@/modules/fractal/api/entities/scene';

export interface ComputeGlbUrlParams {
    teamId: string;
    trajectoryId: string;
    currentTimestep: number | undefined;
    analysisId: string;
    activeScene?: SceneObjectType;
};

const DEFAULT_ANALYSIS_ID = 'default';

const buildApiUrl = (path: string): string => {
    return buildBackendUrl(path);
};

const buildPluginUrl = (
    teamId: string,
    trajectoryId: string,
    scene: PluginScene,
    timestep: number
): string | null => {
    const { analysisId, exposureId } = scene;
    if (!analysisId || !exposureId) return null;
    return buildApiUrl(`/api/plugins/${teamId}/exposures/glb/${trajectoryId}/${analysisId}/${exposureId}/${timestep}`);
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
    return buildApiUrl(`/api/color-codings/${teamId}/${trajectoryId}/${effectiveAnalysisId}?${params.toString()}`);
};

const buildParticleFilterUrl = (
    teamId: string,
    trajectoryId: string,
    scene: ParticleFilterScene,
    timestep: number
): string | null => {
    const {
        property,
        operator,
        value,
        analysisId,
        exposureId,
        action,
        combinator,
        conditions,
        mode,
        preset,
        presetConfig
    } = scene;
    if (!action) return null;

    const effectiveAnalysisId = analysisId || DEFAULT_ANALYSIS_ID;
    const params = new URLSearchParams({
        timestep: String(timestep),
        action
    });

    if (Array.isArray(conditions) && conditions.length > 0) {
        params.set('combinator', combinator || 'AND');
        params.set('conditions', JSON.stringify(conditions));
    } else if (mode === 'preset') {
        if (!preset || !presetConfig) {
            return null;
        }

        params.set('mode', mode);
        params.set('preset', preset);
        params.set('presetConfig', JSON.stringify(presetConfig));
    } else {
        if (!property || !operator || value === undefined) {
            return null;
        }

        params.set('property', property);
        params.set('operator', operator);
        params.set('value', String(value));
        if (exposureId) {
            params.set('exposureId', exposureId);
        }
    }

    return buildApiUrl(`/api/particle-filters/${teamId}/${trajectoryId}/${effectiveAnalysisId}?${params.toString()}`);
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
            return buildApiUrl(`/api/trajectories/${teamId}/${trajectoryId}/glb/${currentTimestep}/${analysisId}`);
    }
};
