import type { SceneObjectType } from '@/modules/fractal/presentation/types/stores/editor/scene-types';
import type { SceneArtifact } from '@/modules/trajectory/domain/entities/SceneArtifact';

type MaybeScene = Partial<SceneObjectType> & Record<string, any>;

const normalizeString = (value: unknown): string => {
    if (value === undefined || value === null) return '';
    return String(value);
};

const normalizeNumber = (value: unknown): number => {
    return Number(value);
};

export const isSameScene = (left?: MaybeScene | null, right?: MaybeScene | null): boolean => {
    if (!left || !right) return false;

    const sameBase = normalizeString(left.sceneType) === normalizeString(right.sceneType)
        && normalizeString(left.source) === normalizeString(right.source)
        && normalizeString(left.analysisId) === normalizeString(right.analysisId)
        && normalizeString(left.exposureId) === normalizeString(right.exposureId);

    if (!sameBase) return false;

    if (left.source === 'color-coding' || right.source === 'color-coding') {
        return normalizeString(left.property) === normalizeString(right.property)
            && normalizeString(left.gradient) === normalizeString(right.gradient)
            && normalizeNumber(left.startValue) === normalizeNumber(right.startValue)
            && normalizeNumber(left.endValue) === normalizeNumber(right.endValue);
    }

    if (left.source === 'particle-filter' || right.source === 'particle-filter') {
        return normalizeString(left.property) === normalizeString(right.property)
            && normalizeString(left.operator) === normalizeString(right.operator)
            && normalizeString(left.action || 'delete') === normalizeString(right.action || 'delete')
            && normalizeNumber(left.value) === normalizeNumber(right.value);
    }

    return true;
};

export const toSceneObjectFromArtifact = (artifact: SceneArtifact): SceneObjectType | null => {
    if (artifact.sourceType === 'color-coding') {
        if (
            typeof artifact.params.property !== 'string'
            || typeof artifact.params.gradient !== 'string'
            || artifact.params.startValue === undefined
            || artifact.params.endValue === undefined
        ) {
            return null;
        }

        return {
            sceneType: 'color-coding',
            source: 'color-coding',
            analysisId: artifact.analysis,
            exposureId: String(artifact.params.exposureId || ''),
            property: artifact.params.property,
            startValue: String(artifact.params.startValue),
            endValue: String(artifact.params.endValue),
            gradient: artifact.params.gradient
        };
    }

    if (artifact.sourceType === 'particle-filter') {
        if (
            typeof artifact.params.property !== 'string'
            || typeof artifact.params.operator !== 'string'
            || artifact.params.value === undefined
            || typeof artifact.params.action !== 'string'
        ) {
            return null;
        }

        return {
            sceneType: 'particle-filter',
            source: 'particle-filter',
            analysisId: artifact.analysis,
            exposureId: artifact.params.exposureId,
            property: artifact.params.property,
            operator: artifact.params.operator,
            value: Number(artifact.params.value),
            action: artifact.params.action
        };
    }

    return null;
};

export const isArtifactSceneActive = (activeScene: MaybeScene | null | undefined, artifact: SceneArtifact): boolean => {
    const scene = toSceneObjectFromArtifact(artifact);
    if (!scene || !activeScene) return false;
    return isSameScene(activeScene, scene);
};
