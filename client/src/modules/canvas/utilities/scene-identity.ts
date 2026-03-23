import {
    ParticleFilterSceneCombinator,
    ParticleFilterSceneConditionKind,
    ParticleFilterSceneMode,
    ParticleFilterScenePreset,
    SurfaceAtomsSceneCutoffMode
} from '@/modules/fractal/api/entities/scene';

import type { SceneObjectType, ParticleFilterSceneCondition } from '@/modules/fractal/api/entities/scene';
import type { SceneArtifact } from '@/modules/trajectory/api/entities/scene-artifacts';

interface MaybeParticleFilterCondition {
    kind?: string;
    property?: string;
    operator?: string;
    value?: number;
    exposureId?: string;
    preset?: string;
    presetConfig?: {
        layers?: number;
        cutoffMode?: string;
        cutoffRadius?: number;
        coordinationDeficit?: number;
        anisotropyThreshold?: number;
        byType?: boolean;
    };
};

interface MaybeScene {
    sceneType?: string;
    source?: string;
    analysisId?: string;
    mode?: string;
    combinator?: string;
    conditions?: MaybeParticleFilterCondition[];
    exposureId?: string;
    property?: string;
    operator?: string;
    value?: number;
    preset?: string;
    presetConfig?: {
        layers?: number;
        cutoffMode?: string;
        cutoffRadius?: number;
        coordinationDeficit?: number;
        anisotropyThreshold?: number;
        byType?: boolean;
    };
    action?: string;
    startValue?: string;
    endValue?: string;
    gradient?: string;
};

const DEFAULT_SURFACE_LAYERS = 10;
const DEFAULT_SURFACE_COORDINATION_DEFICIT = 2;
const DEFAULT_SURFACE_ANISOTROPY_THRESHOLD = 0.35;

const normalizeString = (value: unknown): string => {
    if (value === undefined || value === null) return '';
    return String(value);
};

const normalizeNumber = (value: unknown): number => {
    return Number(value);
};

const normalizePositiveInteger = (value: unknown, fallback: number): number => {
    const parsedValue = Number(value);

    if (!Number.isInteger(parsedValue) || parsedValue < 1) {
        return fallback;
    }

    return parsedValue;
};

const normalizeUnitInterval = (value: unknown, fallback: number): number => {
    const parsedValue = Number(value);

    if (!Number.isFinite(parsedValue) || parsedValue < 0 || parsedValue > 1) {
        return fallback;
    }

    return parsedValue;
};

const normalizeOptionalPositiveNumber = (value: unknown): number | undefined => {
    const parsedValue = Number(value);

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        return undefined;
    }

    return parsedValue;
};

const normalizeParticleFilterConditionSignature = (condition: MaybeParticleFilterCondition): Record<string, unknown> => {
    if (condition.kind === ParticleFilterSceneConditionKind.Preset || condition.preset) {
        const cutoffRadius = normalizeOptionalPositiveNumber(condition.presetConfig?.cutoffRadius);

        return {
            kind: ParticleFilterSceneConditionKind.Preset,
            preset: normalizeString(condition.preset),
            presetConfig: {
                layers: normalizePositiveInteger(condition.presetConfig?.layers, DEFAULT_SURFACE_LAYERS),
                cutoffMode: normalizeString(condition.presetConfig?.cutoffMode),
                cutoffRadius: cutoffRadius ?? null,
                coordinationDeficit: normalizePositiveInteger(
                    condition.presetConfig?.coordinationDeficit,
                    DEFAULT_SURFACE_COORDINATION_DEFICIT
                ),
                anisotropyThreshold: normalizeUnitInterval(
                    condition.presetConfig?.anisotropyThreshold,
                    DEFAULT_SURFACE_ANISOTROPY_THRESHOLD
                ),
                byType: Boolean(condition.presetConfig?.byType)
            }
        };
    }

    return {
        kind: ParticleFilterSceneConditionKind.Property,
        property: normalizeString(condition.property),
        operator: normalizeString(condition.operator),
        value: normalizeNumber(condition.value),
        exposureId: normalizeString(condition.exposureId)
    };
};

const normalizeParticleFilterSignature = (scene: MaybeScene): string => {
    if (Array.isArray(scene.conditions) && scene.conditions.length > 0) {
        return JSON.stringify({
            combinator: normalizeString(scene.combinator || 'AND'),
            conditions: scene.conditions.map(normalizeParticleFilterConditionSignature)
        });
    }

    if (scene.mode === ParticleFilterSceneMode.Preset || scene.preset) {
        return JSON.stringify({
            combinator: 'AND',
            conditions: [normalizeParticleFilterConditionSignature({
                kind: ParticleFilterSceneConditionKind.Preset,
                preset: scene.preset,
                presetConfig: scene.presetConfig
            })]
        });
    }

    return JSON.stringify({
        combinator: 'AND',
        conditions: [normalizeParticleFilterConditionSignature({
            kind: ParticleFilterSceneConditionKind.Property,
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
        const hasLegacyPreset = artifact.params.preset === ParticleFilterScenePreset.SurfaceAtoms && artifact.params.presetConfig;

        if (
            (!hasCompositeConditions && !hasLegacyPreset && typeof artifact.params.property !== 'string')
            || (!hasCompositeConditions && !hasLegacyPreset && typeof artifact.params.operator !== 'string')
            || (!hasCompositeConditions && !hasLegacyPreset && artifact.params.value === undefined)
            || typeof artifact.params.action !== 'string'
        ) {
            return null;
        }

        const conditions = hasCompositeConditions
            ? rawConditions.map((condition): ParticleFilterSceneCondition => {
                if (condition.kind === ParticleFilterSceneConditionKind.Preset || 'preset' in condition) {
                    const presetConfig = 'presetConfig' in condition ? condition.presetConfig : undefined;
                    const cutoffRadius = normalizeOptionalPositiveNumber(presetConfig?.cutoffRadius);

                    return {
                        kind: ParticleFilterSceneConditionKind.Preset,
                        preset: ParticleFilterScenePreset.SurfaceAtoms,
                        presetConfig: {
                            layers: normalizePositiveInteger(presetConfig?.layers, DEFAULT_SURFACE_LAYERS),
                            cutoffMode: presetConfig?.cutoffMode === SurfaceAtomsSceneCutoffMode.Manual
                                ? SurfaceAtomsSceneCutoffMode.Manual
                                : SurfaceAtomsSceneCutoffMode.Auto,
                            ...(cutoffRadius === undefined ? {} : { cutoffRadius }),
                            coordinationDeficit: normalizePositiveInteger(
                                presetConfig?.coordinationDeficit,
                                DEFAULT_SURFACE_COORDINATION_DEFICIT
                            ),
                            anisotropyThreshold: normalizeUnitInterval(
                                presetConfig?.anisotropyThreshold,
                                DEFAULT_SURFACE_ANISOTROPY_THRESHOLD
                            ),
                            byType: Boolean(presetConfig?.byType)
                        }
                    };
                }

                return {
                    kind: ParticleFilterSceneConditionKind.Property,
                    property: String(condition.property || ''),
                    operator: String(condition.operator || ''),
                    value: Number(condition.value),
                    ...(condition.exposureId ? { exposureId: String(condition.exposureId) } : {})
                };
            })
            : hasLegacyPreset
                ? [{
                    kind: ParticleFilterSceneConditionKind.Preset,
                    preset: ParticleFilterScenePreset.SurfaceAtoms,
                    presetConfig: {
                        layers: normalizePositiveInteger(artifact.params.presetConfig?.layers, DEFAULT_SURFACE_LAYERS),
                        cutoffMode: artifact.params.presetConfig?.cutoffMode === SurfaceAtomsSceneCutoffMode.Manual
                            ? SurfaceAtomsSceneCutoffMode.Manual
                            : SurfaceAtomsSceneCutoffMode.Auto,
                        ...(normalizeOptionalPositiveNumber(artifact.params.presetConfig?.cutoffRadius) === undefined
                            ? {}
                            : { cutoffRadius: normalizeOptionalPositiveNumber(artifact.params.presetConfig?.cutoffRadius) }),
                        coordinationDeficit: normalizePositiveInteger(
                            artifact.params.presetConfig?.coordinationDeficit,
                            DEFAULT_SURFACE_COORDINATION_DEFICIT
                        ),
                        anisotropyThreshold: normalizeUnitInterval(
                            artifact.params.presetConfig?.anisotropyThreshold,
                            DEFAULT_SURFACE_ANISOTROPY_THRESHOLD
                        ),
                        byType: Boolean(artifact.params.presetConfig?.byType)
                    }
                }] satisfies ParticleFilterSceneCondition[]
                : [{
                    kind: ParticleFilterSceneConditionKind.Property,
                    property: String(artifact.params.property || ''),
                    operator: String(artifact.params.operator || ''),
                    value: Number(artifact.params.value),
                    ...(artifact.params.exposureId ? { exposureId: String(artifact.params.exposureId) } : {})
                }] satisfies ParticleFilterSceneCondition[];
        const firstPropertyCondition = conditions.find((condition) => {
            return condition.kind === ParticleFilterSceneConditionKind.Property;
        });

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

export const isArtifactSceneActive = (activeScene: MaybeScene | null | undefined, artifact: SceneArtifact): boolean => {
    const scene = toSceneObjectFromArtifact(artifact);
    if (!scene || !activeScene) return false;
    return isSameScene(activeScene, scene);
};
