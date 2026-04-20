import { buildBackendUrl } from '@/app/core/http/utilities/backend-origin';
import type { CanvasAccessMode } from '@/modules/canvas/api/access';
import type {
    SceneObjectType,
    PluginScene,
    ColorCodingScene,
    ParticleFilterScene,
    ParticleFilterSceneCondition
} from '@/modules/fractal/api/entities/scene';

export interface ComputeGlbUrlParams {
    teamId: string;
    trajectoryId: string;
    currentTimestep: number | undefined;
    analysisId: string;
    activeScene?: SceneObjectType;
    mode?: CanvasAccessMode;
};

const DEFAULT_ANALYSIS_ID = 'default';

const isPropertyCondition = (condition: ParticleFilterSceneCondition) => {
    return typeof condition?.property === 'string'
        && typeof condition?.operator === 'string'
        && condition?.value !== undefined;
};

const buildApiUrl = (path: string): string => {
    return buildBackendUrl(path);
};

const buildPluginUrl = (
    mode: CanvasAccessMode,
    teamId: string,
    trajectoryId: string,
    scene: PluginScene,
    timestep: number
): string | null => {
    const { analysisId, exposureId } = scene;
    if (!analysisId || !exposureId) return null;

    if (mode === 'public') {
        return buildApiUrl(`/api/canvas/${trajectoryId}/exposures/${analysisId}/${exposureId}/${timestep}/glb`);
    }

    return buildApiUrl(`/api/plugins/${teamId}/exposures/glb/${trajectoryId}/${analysisId}/${exposureId}/${timestep}`);
};

const buildColorCodingUrl = (
    mode: CanvasAccessMode,
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

    if (mode === 'public') {
        return buildApiUrl(`/api/canvas/${trajectoryId}/color-coding/model/${effectiveAnalysisId}?${params.toString()}`);
    }

    return buildApiUrl(`/api/color-codings/${teamId}/${trajectoryId}/${effectiveAnalysisId}?${params.toString()}`);
};

const buildParticleFilterUrl = (
    mode: CanvasAccessMode,
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
        conditions
    } = scene;
    if (!action) return null;

    const effectiveAnalysisId = analysisId || DEFAULT_ANALYSIS_ID;
    const params = new URLSearchParams({
        timestep: String(timestep),
        action
    });

    const validConditions = Array.isArray(conditions)
        ? conditions.filter(isPropertyCondition)
        : [];

    if (validConditions.length > 0) {
        params.set('combinator', combinator || 'AND');
        params.set('conditions', JSON.stringify(validConditions));
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

    if (mode === 'public') {
        return buildApiUrl(`/api/canvas/${trajectoryId}/particle-filter/model/${effectiveAnalysisId}?${params.toString()}`);
    }

    return buildApiUrl(`/api/particle-filters/${teamId}/${trajectoryId}/${effectiveAnalysisId}?${params.toString()}`);
};

export const computeGlbUrl = ({
    teamId,
    trajectoryId,
    currentTimestep,
    analysisId,
    activeScene,
    mode = 'rbac'
}: ComputeGlbUrlParams): string | null => {
    if (!trajectoryId || currentTimestep === undefined) return null;

    switch (activeScene?.source) {
        case 'plugin':
            return buildPluginUrl(mode, teamId, trajectoryId, activeScene, currentTimestep);
        case 'color-coding':
            return buildColorCodingUrl(mode, teamId, trajectoryId, activeScene, currentTimestep);
        case 'particle-filter':
            return buildParticleFilterUrl(mode, teamId, trajectoryId, activeScene, currentTimestep);
        default:
            return buildApiUrl(`/api/canvas/${trajectoryId}/glb/${currentTimestep}/${analysisId}`);
    }
};
