import { buildBackendUrl } from '@/app/core/http/utils/backend-origin';
import type { CanvasAccessMode } from '@/modules/canvas/api/access';
import type {
    SceneObjectType,
    PluginScene,
    ColorCodingScene,
    LineStyleScene,
    ParticleFilterScene,
    ParticleFilterSceneCondition
} from '@/modules/fractal/contracts/scene';

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
        return buildBackendUrl(`/api/public/trajectories/${trajectoryId}/exposures/${analysisId}/${exposureId}/${timestep}/glb`);
    }

    return buildBackendUrl(`/api/teams/${teamId}/plugins/exposures/${trajectoryId}/${analysisId}/${exposureId}/${timestep}/glb`);
};

const buildColorCodingUrl = (
    mode: CanvasAccessMode,
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
    if (analysisId) params.set('analysisId', analysisId);

    if (mode === 'public') {
        return buildBackendUrl(`/api/public/trajectories/${trajectoryId}/color-codings/model?${params.toString()}`);
    }

    return buildBackendUrl(`/api/teams/${teamId}/trajectories/${trajectoryId}/color-codings/model?${params.toString()}`);
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

    if (analysisId) params.set('analysisId', analysisId);

    if (mode === 'public') {
        return buildBackendUrl(`/api/public/trajectories/${trajectoryId}/particle-filters/model?${params.toString()}`);
    }

    return buildBackendUrl(`/api/teams/${teamId}/trajectories/${trajectoryId}/particle-filters/model?${params.toString()}`);
};

const buildLineStyleUrl = (
    mode: CanvasAccessMode,
    teamId: string,
    trajectoryId: string,
    scene: LineStyleScene,
    timestep: number
): string | null => {
    const { analysisId, exposureId, style } = scene;
    if (!analysisId || !exposureId) return null;

    if (mode === 'public') {
        return null;
    }

    const params = new URLSearchParams({
        timestep: String(timestep),
        style: JSON.stringify(style ?? {})
    });

    return buildBackendUrl(`/api/teams/${teamId}/trajectories/${trajectoryId}/analyses/${analysisId}/exposures/${exposureId}/line-style/model?${params.toString()}`);
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
        case 'line-style': {
            const url = buildLineStyleUrl(mode, teamId, trajectoryId, activeScene, currentTimestep);
            return {
                url,
                resourceKey: url
            };
        }
        default: {
            const query = analysisId ? `?${new URLSearchParams({ analysisId }).toString()}` : '';
            return {
                url: buildBackendUrl(`/api/public/trajectories/${trajectoryId}/frames/${currentTimestep}/glb${query}`),
                resourceKey: `trajectory:${trajectoryId}:${currentTimestep}`
            };
        }
    }
};
