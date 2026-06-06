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
    analysisId?: string;
    activeScene?: SceneObjectType;
    mode?: CanvasAccessMode;
}

export interface ResolvedGlbResource {
    url: string | null;
    resourceKey: string | null;
}

const DEFAULT_ANALYSIS_ID = 'default';

const isPropertyCondition = (condition: ParticleFilterSceneCondition) => {
    return typeof condition?.property === 'string'
        && typeof condition?.operator === 'string'
        && condition?.value !== undefined;
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
        return buildBackendUrl(`/api/canvas/${trajectoryId}/exposures/${analysisId}/${exposureId}/${timestep}/glb`);
    }

    return buildBackendUrl(`/api/plugins/${teamId}/exposures/glb/${trajectoryId}/${analysisId}/${exposureId}/${timestep}`);
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
        return buildBackendUrl(`/api/canvas/${trajectoryId}/color-coding/model/${effectiveAnalysisId}?${params.toString()}`);
    }

    return buildBackendUrl(`/api/color-codings/${teamId}/${trajectoryId}/${effectiveAnalysisId}?${params.toString()}`);
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
        return buildBackendUrl(`/api/canvas/${trajectoryId}/particle-filter/model/${effectiveAnalysisId}?${params.toString()}`);
    }

    return buildBackendUrl(`/api/particle-filters/${teamId}/${trajectoryId}/${effectiveAnalysisId}?${params.toString()}`);
};

export const resolveGlbResource = ({
    teamId,
    trajectoryId,
    currentTimestep,
    analysisId,
    activeScene,
    mode = 'rbac'
}: ComputeGlbUrlParams): ResolvedGlbResource => {
    if (!trajectoryId || currentTimestep === undefined) {
        return {
            url: null,
            resourceKey: null
        };
    }

    switch (activeScene?.source) {
        case 'plugin': {
            const url = buildPluginUrl(mode, teamId, trajectoryId, activeScene, currentTimestep);
            return {
                url,
                resourceKey: url
            };
        }
        case 'color-coding': {
            const url = buildColorCodingUrl(mode, teamId, trajectoryId, activeScene, currentTimestep);
            return {
                url,
                resourceKey: url
            };
        }
        case 'particle-filter': {
            const url = buildParticleFilterUrl(mode, teamId, trajectoryId, activeScene, currentTimestep);
            return {
                url,
                resourceKey: url
            };
        }
        default:
            return {
                url: buildBackendUrl(`/api/canvas/${trajectoryId}/glb/${currentTimestep}/${analysisId || DEFAULT_ANALYSIS_ID}`),
                // Why: the default trajectory GLB endpoint ignores analysisId
                // server-side, so analysis selection must not invalidate the
                // core model identity or trigger a reload.
                resourceKey: `trajectory:${trajectoryId}:${currentTimestep}`
            };
    }
};
