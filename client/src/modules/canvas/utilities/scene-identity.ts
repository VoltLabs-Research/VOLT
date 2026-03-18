import { ParticleFilterSceneCombinator } from '@/modules/fractal/api/entities/scene';

import type { SceneObjectType, ParticleFilterSceneCondition } from '@/modules/fractal/api/entities/scene';
import type { SceneArtifact } from '@/modules/trajectory/api/entities/scene-artifacts';

interface MaybeParticleFilterCondition {
    property?: string;
    operator?: string;
    value?: number;
    exposureId?: string;
};

interface MaybeScene {
    sceneType?: string;
    source?: string;
    analysisId?: string;
    combinator?: string;
    conditions?: MaybeParticleFilterCondition[];
    exposureId?: string;
    property?: string;
    operator?: string;
    value?: number;
    action?: string;
    startValue?: string;
    endValue?: string;
    gradient?: string;
};

const normalizeString = (value: unknown): string => {
    if (value === undefined || value === null) return '';
    return String(value);
};

const normalizeNumber = (value: unknown): number => {
    return Number(value);
};

const normalizeParticleFilterConditions = (scene: MaybeScene): string => {
    if (Array.isArray(scene.conditions) && scene.conditions.length > 0) {
        return JSON.stringify({
            combinator: normalizeString(scene.combinator || 'AND'),
            conditions: scene.conditions.map((condition) => ({
                property: normalizeString(condition.property),
                operator: normalizeString(condition.operator),
                value: normalizeNumber(condition.value),
                exposureId: normalizeString(condition.exposureId)
            }))
        });
    }

    return JSON.stringify({
        combinator: 'AND',
        conditions: [{
            property: normalizeString(scene.property),
            operator: normalizeString(scene.operator),
            value: normalizeNumber(scene.value),
            exposureId: normalizeString(scene.exposureId)
        }]
    });
};

const getArtifactAnalysisId = (analysis: SceneArtifact['analysis']): string | undefined => {
    if (!analysis) {
        return undefined;
    }

    if (typeof analysis === 'string') {
        return analysis;
    }

    return analysis._id;
};

export const isSameScene = (left?: MaybeScene | null, right?: MaybeScene | null): boolean => {
    if (!left || !right) return false;

    const isParticleFilterScene = left.source === 'particle-filter' || right.source === 'particle-filter';

    const sameBase = normalizeString(left.sceneType) === normalizeString(right.sceneType)
        && normalizeString(left.source) === normalizeString(right.source)
        && normalizeString(left.analysisId) === normalizeString(right.analysisId)
        && (isParticleFilterScene || normalizeString(left.exposureId) === normalizeString(right.exposureId));

    if (!sameBase) return false;

    if (left.source === 'color-coding' || right.source === 'color-coding') {
        return normalizeString(left.property) === normalizeString(right.property)
            && normalizeString(left.gradient) === normalizeString(right.gradient)
            && normalizeNumber(left.startValue) === normalizeNumber(right.startValue)
            && normalizeNumber(left.endValue) === normalizeNumber(right.endValue);
    }

    if (left.source === 'particle-filter' || right.source === 'particle-filter') {
        return normalizeString(left.action || 'delete') === normalizeString(right.action || 'delete')
            && normalizeParticleFilterConditions(left) === normalizeParticleFilterConditions(right);
    }

    return true;
};

export const isTimestepScopedScene = (scene?: MaybeScene | null): boolean => {
    if (!scene) {
        return false;
    }

    return scene.source === 'color-coding' || scene.source === 'particle-filter';
};

export const toSceneObjectFromArtifact = (artifact: SceneArtifact): SceneObjectType | null => {
    const analysisId = getArtifactAnalysisId(artifact.analysis);

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
            analysisId,
            exposureId: String(artifact.params.exposureId || ''),
            property: artifact.params.property,
            startValue: String(artifact.params.startValue),
            endValue: String(artifact.params.endValue),
            gradient: artifact.params.gradient
        };
    }

    if (artifact.sourceType === 'particle-filter') {
        const rawConditions = artifact.params.conditions;
        const hasCompositeConditions = Array.isArray(rawConditions) && rawConditions.length > 0;

        if (
            (!hasCompositeConditions && typeof artifact.params.property !== 'string')
            || (!hasCompositeConditions && typeof artifact.params.operator !== 'string')
            || (!hasCompositeConditions && artifact.params.value === undefined)
            || typeof artifact.params.action !== 'string'
        ) {
            return null;
        }

        const conditions = hasCompositeConditions
            ? rawConditions.map((condition): ParticleFilterSceneCondition => ({
                property: String(condition.property || ''),
                operator: String(condition.operator || ''),
                value: Number(condition.value),
                ...(condition.exposureId ? { exposureId: String(condition.exposureId) } : {})
            }))
            : [{
                property: String(artifact.params.property || ''),
                operator: String(artifact.params.operator || ''),
                value: Number(artifact.params.value),
                ...(artifact.params.exposureId ? { exposureId: String(artifact.params.exposureId) } : {})
            }] satisfies ParticleFilterSceneCondition[];
        const firstCondition = conditions[0];

        return {
            sceneType: 'particle-filter',
            source: 'particle-filter',
            analysisId,
            combinator: artifact.params.combinator === ParticleFilterSceneCombinator.Or
                ? ParticleFilterSceneCombinator.Or
                : ParticleFilterSceneCombinator.And,
            conditions,
            exposureId: firstCondition?.exposureId,
            property: firstCondition?.property,
            operator: firstCondition?.operator,
            value: firstCondition?.value,
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
