import {
    ParticleFilterSceneCombinator
} from '@/modules/fractal/api/entities/scene';

import type { SceneObjectType, ParticleFilterSceneCondition, SceneRenderMetadata } from '@/modules/fractal/api/entities/scene';
import type { SceneArtifact } from '@/modules/trajectory/api/entities/scene-artifacts/scene-artifact';

interface MaybeParticleFilterCondition {
    property?: string;
    operator?: string;
    value?: number | string;
    exposureId?: string;
}

interface MaybeScene {
    sceneType?: string;
    source?: string;
    analysisId?: string;
    combinator?: string;
    conditions?: MaybeParticleFilterCondition[];
    exposureId?: string;
    property?: string;
    operator?: string;
    value?: number | string;
    action?: string;
    startValue?: string;
    endValue?: string;
    gradient?: string;
}

const normalizeParticleFilterConditionSignature = (condition: MaybeParticleFilterCondition): Record<string, unknown> => {
    const normalizedValue = typeof condition.value === 'number'
        ? condition.value
        : String(condition.value ?? '');

    return {
        kind: 'property',
        property: condition.property ?? '',
        operator: condition.operator ?? '',
        value: normalizedValue,
        exposureId: condition.exposureId ?? ''
    };
};

const normalizeParticleFilterSignature = (scene: MaybeScene): string => {
    if (Array.isArray(scene.conditions) && scene.conditions.length > 0) {
        return JSON.stringify({
            combinator: scene.combinator ?? 'AND',
            conditions: scene.conditions.map(normalizeParticleFilterConditionSignature)
        });
    }

    return JSON.stringify({
        combinator: 'AND',
        conditions: [normalizeParticleFilterConditionSignature({
            property: scene.property,
            operator: scene.operator,
            value: scene.value,
            exposureId: scene.exposureId
        })]
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

    const sameBase = (left.sceneType ?? '') === (right.sceneType ?? '')
        && (left.source ?? '') === (right.source ?? '')
        && (left.analysisId ?? '') === (right.analysisId ?? '')
        && (isParticleFilterScene || (left.exposureId ?? '') === (right.exposureId ?? ''));

    if (!sameBase) return false;

    if (left.source === 'color-coding' || right.source === 'color-coding') {
        return (left.property ?? '') === (right.property ?? '')
            && (left.gradient ?? '') === (right.gradient ?? '')
            && Number(left.startValue) === Number(right.startValue)
            && Number(left.endValue) === Number(right.endValue);
    }

    if (left.source === 'particle-filter' || right.source === 'particle-filter') {
        return (left.action ?? 'delete') === (right.action ?? 'delete')
            && normalizeParticleFilterSignature(left) === normalizeParticleFilterSignature(right);
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
            artifact.params.property === undefined
            || artifact.params.gradient === undefined
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
            (!hasCompositeConditions && artifact.params.property === undefined)
            || (!hasCompositeConditions && artifact.params.operator === undefined)
            || (!hasCompositeConditions && artifact.params.value === undefined)
            || artifact.params.action === undefined
        ) {
            return null;
        }

        const conditions = hasCompositeConditions
            ? rawConditions.flatMap((condition): ParticleFilterSceneCondition[] => {
                if (
                    typeof condition.property !== 'string'
                    || typeof condition.operator !== 'string'
                    || condition.value === undefined
                ) {
                    return [];
                }

                return [{
                    kind: 'property',
                    property: String(condition.property),
                    operator: String(condition.operator),
                    value: typeof condition.value === 'number' ? condition.value : String(condition.value),
                    ...(condition.exposureId ? { exposureId: String(condition.exposureId) } : {})
                }];
            })
            : [{
                kind: 'property',
                property: String(artifact.params.property || ''),
                operator: String(artifact.params.operator || ''),
                value: typeof artifact.params.value === 'number'
                    ? artifact.params.value
                    : String(artifact.params.value),
                ...(artifact.params.exposureId ? { exposureId: String(artifact.params.exposureId) } : {})
            }] satisfies ParticleFilterSceneCondition[];

        if (conditions.length === 0) {
            return null;
        }

        const firstPropertyCondition = conditions[0];

        return {
            sceneType: 'particle-filter',
            source: 'particle-filter',
            analysisId,
            combinator: artifact.params.combinator === ParticleFilterSceneCombinator.Or
                ? ParticleFilterSceneCombinator.Or
                : ParticleFilterSceneCombinator.And,
            conditions,
            exposureId: firstPropertyCondition?.exposureId,
            property: firstPropertyCondition?.property,
            operator: firstPropertyCondition?.operator,
            value: firstPropertyCondition?.value,
            action: artifact.params.action
        };
    }

    return null;
};

export const isSameSceneRenderMetadata = (
    left?: SceneRenderMetadata,
    right?: SceneRenderMetadata
): boolean => {
    return left?.exporter === right?.exporter
        && left?.exportType === right?.exportType
        && left?.defaultLineWidth === right?.defaultLineWidth;
};

export const isArtifactSceneActive = (activeScene: MaybeScene | null | undefined, artifact: SceneArtifact): boolean => {
    const scene = toSceneObjectFromArtifact(artifact);
    if (!scene || !activeScene) return false;
    return isSameScene(activeScene, scene);
};
