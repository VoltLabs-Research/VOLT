import useModifierBase from './use-modifier-base';
import { parseNumericInput } from '../utilities/parse-numeric-input';
import {
    ParticleFilterSceneCombinator,
    ParticleFilterSceneConditionKind,
    ParticleFilterScenePreset,
    SurfaceAtomsSceneCutoffMode
} from '@/modules/fractal/api/entities/scene';
import useFrameProperties from '@/modules/trajectory/hooks/particle-filter/use-frame-properties';
import { buildPropertyOptions, resolvePropertySelection } from '@/modules/trajectory/hooks/particle-filter/use-property-selector.utilities';
import { useApplyFilterMutation, uniqueValuesQuery, usePreviewFilterMutation } from '@/modules/trajectory/hooks/particle-filter/queries';
import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { sileo } from 'sileo';

import type {
    ParticleFilterScene,
    ParticleFilterSceneCondition,
    SurfaceAtomsScenePresetConfig
} from '@/modules/fractal/api/entities/scene';
import {
    ParticleFilterCombinator,
    ParticleFilterConditionKind,
    ParticleFilterPreset,
    SurfaceAtomsCutoffMode
} from '@/modules/trajectory/api/dtos/particle-filter';
import type { PropertyOption } from '@/modules/trajectory/hooks/particle-filter/use-property-selector.utilities';
import type {
    ParticleFilterConditionDTO,
    ParticleFilterPropertyConditionDTO,
    SurfaceAtomsPresetConfigDTO
} from '@/modules/trajectory/api/dtos/particle-filter';
import type { UseModifierBaseOptions } from './use-modifier-base';

export enum FilterOperator {
    Equal = '==',
    NotEqual = '!=',
    GreaterThan = '>',
    GreaterThanOrEqual = '>=',
    LessThan = '<',
    LessThanOrEqual = '<='
};

export enum FilterAction {
    Delete = 'delete',
    Highlight = 'highlight'
};

interface FilterOption<TValue extends string> {
    value: TValue;
    title: string;
};

interface ConditionSelection {
    property: string;
    propertyValue: string;
    exposureId: string | null;
};

interface SurfaceAtomsPresetState {
    layersInput: string;
    cutoffMode: SurfaceAtomsCutoffMode;
    cutoffRadiusInput: string;
    coordinationDeficitInput: string;
    anisotropyThresholdInput: string;
    byType: boolean;
};

interface BaseFilterConditionState {
    id: string;
    kind: ParticleFilterConditionKind;
}

export interface PropertyFilterConditionState extends BaseFilterConditionState {
    kind: ParticleFilterConditionKind.Property;
    property: string;
    propertyValue: string;
    exposureId: string | null;
    operator: FilterOperator;
    value: number;
    valueInput: string;
}

export interface PresetFilterConditionState extends BaseFilterConditionState {
    kind: ParticleFilterConditionKind.Preset;
    preset: ParticleFilterPreset.SurfaceAtoms;
    presetState: SurfaceAtomsPresetState;
}

export type FilterConditionState =
    | PropertyFilterConditionState
    | PresetFilterConditionState;

interface PreviewRequest {
    combinator: ParticleFilterCombinator;
    conditions: ParticleFilterConditionDTO[];
}

export interface PreviewResult {
    matchCount: number;
    totalCount: number;
    request: PreviewRequest;
}

const DEFAULT_NUMERIC_VALUE = '0';
const DEFAULT_SURFACE_LAYERS = '10';
const DEFAULT_SURFACE_COORDINATION_DEFICIT = '2';
const DEFAULT_SURFACE_ANISOTROPY_THRESHOLD = '0.35';

const DEFAULT_SURFACE_PRESET_STATE: SurfaceAtomsPresetState = {
    layersInput: DEFAULT_SURFACE_LAYERS,
    cutoffMode: SurfaceAtomsCutoffMode.Auto,
    cutoffRadiusInput: '',
    coordinationDeficitInput: DEFAULT_SURFACE_COORDINATION_DEFICIT,
    anisotropyThresholdInput: DEFAULT_SURFACE_ANISOTROPY_THRESHOLD,
    byType: true
};

let conditionCounter = 0;

const buildConditionId = (): string => {
    conditionCounter += 1;
    return `particle-filter-condition-${conditionCounter}`;
};

const isPropertyConditionState = (
    condition: FilterConditionState
): condition is PropertyFilterConditionState => {
    return condition.kind === ParticleFilterConditionKind.Property;
};

const isPresetConditionState = (
    condition: FilterConditionState
): condition is PresetFilterConditionState => {
    return condition.kind === ParticleFilterConditionKind.Preset;
};

const isPropertyConditionDTO = (
    condition: ParticleFilterConditionDTO
): condition is ParticleFilterPropertyConditionDTO => {
    return condition.kind === ParticleFilterConditionKind.Property;
};

const findDefaultPropertyOption = (propertyOptions: PropertyOption[]): PropertyOption | undefined => {
    const typeOption = propertyOptions.find((option) => option.exposureId === null && option.property.toLowerCase() === 'type');
    if (typeOption) {
        return typeOption;
    }

    return propertyOptions[0];
};

const resolveConditionSelection = (
    propertyOptions: PropertyOption[],
    propertyValue?: string
): ConditionSelection => {
    const selectedOption = propertyValue
        ? propertyOptions.find((option) => option.value === propertyValue)
        : undefined;

    if (selectedOption) {
        return {
            property: selectedOption.property,
            propertyValue: selectedOption.value,
            exposureId: selectedOption.exposureId
        };
    }

    const defaultOption = findDefaultPropertyOption(propertyOptions);
    if (!defaultOption) {
        return {
            property: '',
            propertyValue: '',
            exposureId: null
        };
    }

    return {
        property: defaultOption.property,
        propertyValue: defaultOption.value,
        exposureId: defaultOption.exposureId
    };
};

const createPropertyCondition = (
    propertyOptions: PropertyOption[],
    id: string = buildConditionId()
): PropertyFilterConditionState => {
    const selection = resolveConditionSelection(propertyOptions);

    return {
        id,
        kind: ParticleFilterConditionKind.Property,
        property: selection.property,
        propertyValue: selection.propertyValue,
        exposureId: selection.exposureId,
        operator: FilterOperator.Equal,
        value: 0,
        valueInput: DEFAULT_NUMERIC_VALUE
    };
};

const createPresetCondition = (
    id: string = buildConditionId()
): PresetFilterConditionState => {
    return {
        id,
        kind: ParticleFilterConditionKind.Preset,
        preset: ParticleFilterPreset.SurfaceAtoms,
        presetState: { ...DEFAULT_SURFACE_PRESET_STATE }
    };
};

const syncConditionWithPropertyOptions = (
    condition: PropertyFilterConditionState,
    propertyOptions: PropertyOption[]
): PropertyFilterConditionState => {
    const selection = resolveConditionSelection(propertyOptions, condition.propertyValue);

    if (
        condition.property === selection.property
        && condition.propertyValue === selection.propertyValue
        && condition.exposureId === selection.exposureId
    ) {
        return condition;
    }

    return {
        ...condition,
        property: selection.property,
        propertyValue: selection.propertyValue,
        exposureId: selection.exposureId
    };
};

const parsePositiveIntegerInput = (value: string): number | null => {
    const parsedValue = parseNumericInput(value);
    if (parsedValue === null || !Number.isInteger(parsedValue) || parsedValue < 1) {
        return null;
    }

    return parsedValue;
};

const buildSurfaceAtomsPresetConfig = (
    presetState: SurfaceAtomsPresetState
): SurfaceAtomsPresetConfigDTO | null => {
    const layers = parsePositiveIntegerInput(presetState.layersInput);
    const coordinationDeficit = parsePositiveIntegerInput(presetState.coordinationDeficitInput);
    const anisotropyThreshold = parseNumericInput(presetState.anisotropyThresholdInput);

    if (
        layers === null
        || coordinationDeficit === null
        || anisotropyThreshold === null
        || anisotropyThreshold < 0
        || anisotropyThreshold > 1
    ) {
        return null;
    }

    if (presetState.cutoffMode === SurfaceAtomsCutoffMode.Manual) {
        const cutoffRadius = parseNumericInput(presetState.cutoffRadiusInput);
        if (cutoffRadius === null || cutoffRadius <= 0) {
            return null;
        }

        return {
            layers,
            cutoffMode: SurfaceAtomsCutoffMode.Manual,
            cutoffRadius,
            coordinationDeficit,
            anisotropyThreshold,
            byType: presetState.byType
        };
    }

    return {
        layers,
        cutoffMode: SurfaceAtomsCutoffMode.Auto,
        coordinationDeficit,
        anisotropyThreshold,
        byType: presetState.byType
    };
};

const toConditionDTO = (condition: FilterConditionState): ParticleFilterConditionDTO | null => {
    if (isPresetConditionState(condition)) {
        const presetConfig = buildSurfaceAtomsPresetConfig(condition.presetState);
        if (!presetConfig) {
            return null;
        }

        return {
            kind: ParticleFilterConditionKind.Preset,
            preset: condition.preset,
            presetConfig
        };
    }

    const parsedValue = parseNumericInput(condition.valueInput);
    if (!condition.property || parsedValue === null) {
        return null;
    }

    return {
        kind: ParticleFilterConditionKind.Property,
        property: condition.property,
        operator: condition.operator,
        value: parsedValue,
        ...(condition.exposureId ? { exposureId: condition.exposureId } : {})
    };
};

const toSurfaceSceneConfig = (
    config: SurfaceAtomsPresetConfigDTO
): SurfaceAtomsScenePresetConfig => {
    return {
        layers: config.layers,
        cutoffMode: config.cutoffMode === SurfaceAtomsCutoffMode.Manual
            ? SurfaceAtomsSceneCutoffMode.Manual
            : SurfaceAtomsSceneCutoffMode.Auto,
        ...(config.cutoffRadius === undefined ? {} : { cutoffRadius: config.cutoffRadius }),
        coordinationDeficit: config.coordinationDeficit,
        anisotropyThreshold: config.anisotropyThreshold,
        byType: config.byType
    };
};

const toSceneCondition = (condition: ParticleFilterConditionDTO): ParticleFilterSceneCondition => {
    if (condition.kind === ParticleFilterConditionKind.Preset) {
        return {
            kind: ParticleFilterSceneConditionKind.Preset,
            preset: ParticleFilterScenePreset.SurfaceAtoms,
            presetConfig: toSurfaceSceneConfig(condition.presetConfig)
        };
    }

    return {
        kind: ParticleFilterSceneConditionKind.Property,
        property: condition.property,
        operator: condition.operator,
        value: condition.value,
        ...(condition.exposureId ? { exposureId: condition.exposureId } : {})
    };
};

const toScene = (
    analysisId: string | undefined,
    action: FilterAction,
    request: PreviewRequest
): ParticleFilterScene => {
    const conditions = request.conditions.map(toSceneCondition);
    const firstPropertyCondition = conditions.find((condition) => {
        return condition.kind === ParticleFilterSceneConditionKind.Property;
    });
    const combinator = request.combinator === ParticleFilterCombinator.Or
        ? ParticleFilterSceneCombinator.Or
        : ParticleFilterSceneCombinator.And;

    return {
        sceneType: 'particle-filter',
        source: 'particle-filter',
        analysisId,
        action,
        combinator,
        conditions,
        exposureId: firstPropertyCondition?.exposureId,
        property: firstPropertyCondition?.property,
        operator: firstPropertyCondition?.operator,
        value: firstPropertyCondition?.value
    };
};

const toLegacyPayload = (request: PreviewRequest): Partial<ParticleFilterPropertyConditionDTO> => {
    if (request.conditions.length !== 1) {
        return {};
    }

    const condition = request.conditions[0];
    if (!isPropertyConditionDTO(condition)) {
        return {};
    }

    return {
        property: condition.property,
        operator: condition.operator,
        value: condition.value,
        ...(condition.exposureId ? { exposureId: condition.exposureId } : {})
    };
};

export const OPERATORS: FilterOption<FilterOperator>[] = [
    { value: FilterOperator.Equal, title: '=' },
    { value: FilterOperator.NotEqual, title: '!=' },
    { value: FilterOperator.GreaterThan, title: '>' },
    { value: FilterOperator.GreaterThanOrEqual, title: '>=' },
    { value: FilterOperator.LessThan, title: '<' },
    { value: FilterOperator.LessThanOrEqual, title: '<=' }
];

export const ACTIONS: FilterOption<FilterAction>[] = [
    { value: FilterAction.Delete, title: 'Delete' },
    { value: FilterAction.Highlight, title: 'Color Selection' }
];

export const MATCH_MODES: FilterOption<ParticleFilterCombinator>[] = [
    { value: ParticleFilterCombinator.And, title: 'Match ALL' },
    { value: ParticleFilterCombinator.Or, title: 'Match ANY' }
];

export const CONDITION_TYPES: FilterOption<ParticleFilterConditionKind>[] = [
    { value: ParticleFilterConditionKind.Property, title: 'Property' },
    { value: ParticleFilterConditionKind.Preset, title: 'Preset' }
];

export const PRESETS: FilterOption<ParticleFilterPreset>[] = [
    { value: ParticleFilterPreset.SurfaceAtoms, title: 'Surface Atoms' }
];

export const SURFACE_CUTOFF_MODES: FilterOption<SurfaceAtomsCutoffMode>[] = [
    { value: SurfaceAtomsCutoffMode.Auto, title: 'Auto Cutoff' },
    { value: SurfaceAtomsCutoffMode.Manual, title: 'Manual Cutoff' }
];

const useParticleFilter = (options: UseModifierBaseOptions = {}) => {
    const {
        trajectoryId,
        analysisId,
        currentTimestep,
        setActiveScene
    } = useModifierBase(options);
    const { properties, isLoading: isLoadingProperties } = useFrameProperties({
        trajectoryId,
        analysisId,
        timestep: currentTimestep
    });
    const propertyOptions = useMemo(() => buildPropertyOptions(properties), [properties]);

    const previewMutation = usePreviewFilterMutation();
    const applyFilterMutation = useApplyFilterMutation();
    const [uniqueValuesEnabled, setUniqueValuesEnabled] = useState(false);
    const [suggestionsConditionId, setSuggestionsConditionId] = useState<string | null>(null);
    const [matchMode, setMatchMode] = useState<ParticleFilterCombinator>(ParticleFilterCombinator.And);
    const [conditions, setConditions] = useState<FilterConditionState[]>(() => [createPropertyCondition([])]);
    const [action, setAction] = useState<FilterAction>(FilterAction.Delete);
    const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const resetPreviewState = useCallback(() => {
        setPreviewResult(null);
        setError(null);
    }, []);

    const previewConditionId = suggestionsConditionId ?? conditions[0]?.id ?? null;
    const previewCondition = useMemo(() => {
        return conditions.find((condition) => condition.id === previewConditionId) ?? null;
    }, [conditions, previewConditionId]);

    const uniqueValuesParams = useMemo(() => {
        if (
            !previewCondition
            || !isPropertyConditionState(previewCondition)
            || !previewCondition.property
            || !trajectoryId
            || currentTimestep === undefined
        ) {
            return null;
        }

        return {
            trajectoryId,
            analysisId,
            timestep: currentTimestep,
            property: previewCondition.property,
            exposureId: previewCondition.exposureId ?? undefined,
            maxValues: 50
        };
    }, [previewCondition, trajectoryId, analysisId, currentTimestep]);

    const uniqueValuesResult = uniqueValuesQuery(
        uniqueValuesParams ?? {
            trajectoryId: '',
            timestep: 0,
            property: ''
        },
        {
            enabled: uniqueValuesEnabled && Boolean(uniqueValuesParams),
            retry: false,
            staleTime: 5 * 60 * 1000
        }
    );

    const isLoadingPreview = previewMutation.isPending;
    const isApplying = applyFilterMutation.isPending;

    const conditionSuggestions = useMemo(() => {
        return uniqueValuesResult.data?.values ?? [];
    }, [uniqueValuesResult.data]);

    const syncAllConditions = useCallback((currentConditions: FilterConditionState[]) => {
        if (currentConditions.length === 0) {
            return [createPropertyCondition(propertyOptions)];
        }

        return currentConditions.map((condition) => {
            if (!isPropertyConditionState(condition)) {
                return condition;
            }

            return syncConditionWithPropertyOptions(condition, propertyOptions);
        });
    }, [propertyOptions]);

    useEffect(() => {
        setConditions((currentConditions) => syncAllConditions(currentConditions));
    }, [syncAllConditions]);

    useEffect(() => {
        if (!uniqueValuesEnabled || !uniqueValuesResult.error) {
            return;
        }

        reportError(uniqueValuesResult.error, {
            surface: ErrorSurface.Toast,
            fallbackTitle: isAccessDeniedError(uniqueValuesResult.error)
                ? 'You do not have permission to perform this action.'
                : 'Failed to load suggestions'
        });
    }, [uniqueValuesEnabled, uniqueValuesResult.error]);

    const updateCondition = useCallback((conditionId: string, updater: (condition: FilterConditionState) => FilterConditionState) => {
        setConditions((currentConditions) => currentConditions.map((condition) => {
            if (condition.id !== conditionId) {
                return condition;
            }

            return updater(condition);
        }));
        resetPreviewState();
    }, [resetPreviewState]);

    const addCondition = useCallback(() => {
        setConditions((currentConditions) => [...currentConditions, createPropertyCondition(propertyOptions)]);
        resetPreviewState();
    }, [propertyOptions, resetPreviewState]);

    const removeCondition = useCallback((conditionId: string) => {
        setConditions((currentConditions) => {
            if (currentConditions.length === 1) {
                return [createPropertyCondition(propertyOptions)];
            }

            return currentConditions.filter((condition) => condition.id !== conditionId);
        });
        if (suggestionsConditionId === conditionId) {
            setSuggestionsConditionId(null);
            setUniqueValuesEnabled(false);
        }
        resetPreviewState();
    }, [propertyOptions, suggestionsConditionId, resetPreviewState]);

    const handleConditionKindChange = useCallback((conditionId: string, kind: ParticleFilterConditionKind) => {
        setConditions((currentConditions) => currentConditions.map((condition) => {
            if (condition.id !== conditionId || condition.kind === kind) {
                return condition;
            }

            return kind === ParticleFilterConditionKind.Preset
                ? createPresetCondition(condition.id)
                : createPropertyCondition(propertyOptions, condition.id);
        }));
        if (kind === ParticleFilterConditionKind.Preset && suggestionsConditionId === conditionId) {
            setSuggestionsConditionId(null);
            setUniqueValuesEnabled(false);
        }
        resetPreviewState();
    }, [propertyOptions, suggestionsConditionId, resetPreviewState]);

    const handlePropertyChange = useCallback((conditionId: string, value: string) => {
        updateCondition(conditionId, (condition) => {
            if (!isPropertyConditionState(condition)) {
                return condition;
            }

            const selection = resolvePropertySelection(propertyOptions, value);

            return {
                ...condition,
                property: selection.property,
                propertyValue: value,
                exposureId: selection.exposureId
            };
        });
        if (suggestionsConditionId === conditionId) {
            setUniqueValuesEnabled(false);
        }
    }, [propertyOptions, suggestionsConditionId, updateCondition]);

    const handleOperatorChange = useCallback((conditionId: string, operator: FilterOperator) => {
        updateCondition(conditionId, (condition) => {
            if (!isPropertyConditionState(condition)) {
                return condition;
            }

            return {
                ...condition,
                operator
            };
        });
    }, [updateCondition]);

    const handleValueChange = useCallback((conditionId: string, nextValue: string) => {
        updateCondition(conditionId, (condition) => {
            if (!isPropertyConditionState(condition)) {
                return condition;
            }

            const parsedValue = parseNumericInput(nextValue);
            let value = condition.value;
            if (parsedValue !== null) {
                value = parsedValue;
            }

            return {
                ...condition,
                value,
                valueInput: nextValue
            };
        });
    }, [updateCondition]);

    const handlePresetChange = useCallback((conditionId: string, preset: ParticleFilterPreset) => {
        updateCondition(conditionId, (condition) => {
            if (!isPresetConditionState(condition)) {
                return condition;
            }

            return {
                ...condition,
                preset
            };
        });
    }, [updateCondition]);

    const updatePresetState = useCallback((conditionId: string, updater: (state: SurfaceAtomsPresetState) => SurfaceAtomsPresetState) => {
        updateCondition(conditionId, (condition) => {
            if (!isPresetConditionState(condition)) {
                return condition;
            }

            return {
                ...condition,
                presetState: updater(condition.presetState)
            };
        });
    }, [updateCondition]);

    const handleSurfaceLayersChange = useCallback((conditionId: string, nextValue: string) => {
        updatePresetState(conditionId, (currentPreset) => ({
            ...currentPreset,
            layersInput: nextValue
        }));
    }, [updatePresetState]);

    const handleSurfaceCutoffModeChange = useCallback((conditionId: string, nextValue: SurfaceAtomsCutoffMode) => {
        updatePresetState(conditionId, (currentPreset) => ({
            ...currentPreset,
            cutoffMode: nextValue,
            cutoffRadiusInput: nextValue === SurfaceAtomsCutoffMode.Manual
                ? currentPreset.cutoffRadiusInput
                : ''
        }));
    }, [updatePresetState]);

    const handleSurfaceCutoffRadiusChange = useCallback((conditionId: string, nextValue: string) => {
        updatePresetState(conditionId, (currentPreset) => ({
            ...currentPreset,
            cutoffRadiusInput: nextValue
        }));
    }, [updatePresetState]);

    const handleSurfaceCoordinationDeficitChange = useCallback((conditionId: string, nextValue: string) => {
        updatePresetState(conditionId, (currentPreset) => ({
            ...currentPreset,
            coordinationDeficitInput: nextValue
        }));
    }, [updatePresetState]);

    const handleSurfaceAnisotropyThresholdChange = useCallback((conditionId: string, nextValue: string) => {
        updatePresetState(conditionId, (currentPreset) => ({
            ...currentPreset,
            anisotropyThresholdInput: nextValue
        }));
    }, [updatePresetState]);

    const handleSurfaceByTypeChange = useCallback((conditionId: string, nextValue: boolean) => {
        updatePresetState(conditionId, (currentPreset) => ({
            ...currentPreset,
            byType: nextValue
        }));
    }, [updatePresetState]);

    const fetchValueSuggestions = useCallback((conditionId: string) => {
        const condition = conditions.find((currentCondition) => currentCondition.id === conditionId);
        if (!condition || !isPropertyConditionState(condition)) {
            return;
        }

        setSuggestionsConditionId(conditionId);
        setUniqueValuesEnabled(true);
        sileo.info({ title: 'Loading suggestions...' });
    }, [conditions]);

    const buildPreviewRequest = useCallback((): PreviewRequest | null => {
        const nextConditions = conditions.map(toConditionDTO);
        if (nextConditions.some((condition) => condition === null)) {
            return null;
        }

        return {
            combinator: matchMode,
            conditions: nextConditions.filter((condition): condition is ParticleFilterConditionDTO => condition !== null)
        };
    }, [conditions, matchMode]);

    const handlePreview = useCallback(async () => {
        if (!trajectoryId || currentTimestep === undefined) {
            setError('Missing required parameters');
            return;
        }

        const request = buildPreviewRequest();
        if (!request) {
            setError('Enter a valid value for every condition');
            return;
        }

        const hasPluginCondition = request.conditions.some((condition) => {
            return isPropertyConditionDTO(condition) && Boolean(condition.exposureId);
        });
        if (hasPluginCondition && !analysisId) {
            setError('Analysis required for modifier properties');
            return;
        }

        setError(null);
        setPreviewResult(null);
        sileo.info({ title: 'Generating preview...' });

        try {
            const result = await previewMutation.mutateAsync({
                trajectoryId,
                analysisId,
                timestep: currentTimestep,
                combinator: request.combinator,
                conditions: request.conditions,
                ...toLegacyPayload(request)
            });

            setPreviewResult({
                matchCount: result.matchCount,
                totalCount: result.totalAtoms,
                request
            });
            sileo.success({ title: 'Preview generated' });
        } catch (previewError: unknown) {
            setError(reportError(previewError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Preview failed'
            }).title);
        }
    }, [trajectoryId, currentTimestep, buildPreviewRequest, analysisId, previewMutation]);

    const handleApplyAction = useCallback(async () => {
        if (!previewResult || !trajectoryId || currentTimestep === undefined) {
            setError('Run preview first');
            return;
        }

        setError(null);

        try {
            await showPromise(
                applyFilterMutation.mutateAsync({
                    trajectoryId,
                    analysisId,
                    timestep: currentTimestep,
                    action,
                    combinator: previewResult.request.combinator,
                    conditions: previewResult.request.conditions,
                    ...toLegacyPayload(previewResult.request)
                }),
                {
                    loading: { title: 'Applying filter...' },
                    success: { title: 'Filter applied successfully' },
                    error: { title: 'Failed to apply filter' }
                }
            );

            setActiveScene(toScene(analysisId, action, previewResult.request));
            window.dispatchEvent(new CustomEvent('canvas:scene-artifacts:changed', {
                detail: {
                    sourceType: 'particle-filter',
                    trajectoryId
                }
            }));
            setPreviewResult(null);
        } catch (applyError: unknown) {
            setError(reportError(applyError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Failed to apply filter'
            }).title);
        }
    }, [previewResult, trajectoryId, currentTimestep, applyFilterMutation, analysisId, action, setActiveScene]);

    const handleCancelPreview = useCallback(() => {
        setPreviewResult(null);
        setError(null);
    }, []);

    const percentage = useMemo(() => {
        if (!previewResult || previewResult.totalCount === 0) {
            return '0';
        }

        return ((previewResult.matchCount / previewResult.totalCount) * 100).toFixed(2);
    }, [previewResult]);

    const canPreview = useMemo(() => {
        if (isLoadingPreview || isApplying || isLoadingProperties) {
            return false;
        }

        if (conditions.length === 0) {
            return false;
        }

        return conditions.every((condition) => toConditionDTO(condition) !== null);
    }, [isLoadingPreview, isApplying, isLoadingProperties, conditions]);

    return {
        conditions,
        addCondition,
        removeCondition,
        handleConditionKindChange,
        handlePropertyChange,
        handleOperatorChange,
        handleValueChange,
        handlePresetChange,
        handleSurfaceLayersChange,
        handleSurfaceCutoffModeChange,
        handleSurfaceCutoffRadiusChange,
        handleSurfaceCoordinationDeficitChange,
        handleSurfaceAnisotropyThresholdChange,
        handleSurfaceByTypeChange,
        propertyOptions,
        matchMode,
        setMatchMode,
        action,
        setAction,
        fetchValueSuggestions,
        getValueSuggestions: (conditionId: string) => {
            if (suggestionsConditionId !== conditionId) {
                return [];
            }

            return conditionSuggestions;
        },
        isLoadingValueSuggestions: uniqueValuesResult.isFetching,
        previewResult,
        isLoadingPreview,
        handlePreview,
        handleCancelPreview,
        percentage,
        canPreview,
        isApplying,
        handleApplyAction,
        error
    };
};

export default useParticleFilter;
