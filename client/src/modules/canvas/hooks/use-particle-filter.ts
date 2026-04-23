import useModifierBase from './use-modifier-base';
import { parseNumericInput } from '../utilities/parse-numeric-input';
import { ParticleFilterSceneCombinator } from '@/modules/fractal/api/entities/scene';
import useFrameProperties from '@/modules/trajectory/hooks/particle-filter/use-frame-properties';
import { buildPropertyOptions, resolvePropertySelection } from '@/modules/trajectory/hooks/particle-filter/use-property-selector.utilities';
import { uniqueValuesQuery } from '@/modules/trajectory/hooks/particle-filter/queries';
import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';
import particleFilterService from '@/modules/trajectory/api/services/particle-filter';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sileo } from 'sileo';
import { useCanvasDataAccess } from '@/modules/canvas/api/access';

import type {
    ParticleFilterScene,
    ParticleFilterSceneCondition
} from '@/modules/fractal/api/entities/scene';
import { ParticleFilterCombinator } from '@/modules/trajectory/api/dtos/particle-filter';
import type { PropertyOption } from '@/modules/trajectory/hooks/particle-filter/use-property-selector.utilities';
import type { ParticleFilterConditionDTO } from '@/modules/trajectory/api/dtos/particle-filter';
import type { UseModifierBaseOptions } from './use-modifier-base';

export enum FilterOperator {
    Equal = '==',
    NotEqual = '!=',
    GreaterThan = '>',
    GreaterThanOrEqual = '>=',
    LessThan = '<',
    LessThanOrEqual = '<='
}

export enum FilterAction {
    Delete = 'delete',
    Highlight = 'highlight'
}

interface FilterOption<TValue extends string> {
    value: TValue;
    title: string;
}

interface ConditionSelection {
    property: string;
    propertyValue: string;
    exposureId: string | null;
}

interface FilterConditionState {
    id: string;
    property: string;
    propertyValue: string;
    exposureId: string | null;
    operator: FilterOperator;
    value: number;
    valueInput: string;
}

interface PreviewRequest {
    combinator: ParticleFilterCombinator;
    conditions: ParticleFilterConditionDTO[];
}

interface PreviewResult {
    matchCount: number;
    totalCount: number;
    request: PreviewRequest;
}

const DEFAULT_NUMERIC_VALUE = '0';

let conditionCounter = 0;

const buildConditionId = (): string => {
    conditionCounter += 1;
    return `particle-filter-condition-${conditionCounter}`;
};

const findDefaultPropertyOption = (propertyOptions: PropertyOption[]): PropertyOption | undefined => {
    const typeOption = propertyOptions.find((option) => option.exposureId === null && option.property.toLowerCase() === 'type');
    if (typeOption) return typeOption;
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
        return { property: '', propertyValue: '', exposureId: null };
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
): FilterConditionState => {
    const selection = resolveConditionSelection(propertyOptions);
    return {
        id,
        property: selection.property,
        propertyValue: selection.propertyValue,
        exposureId: selection.exposureId,
        operator: FilterOperator.Equal,
        value: 0,
        valueInput: DEFAULT_NUMERIC_VALUE
    };
};

const syncConditionWithPropertyOptions = (
    condition: FilterConditionState,
    propertyOptions: PropertyOption[]
): FilterConditionState => {
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

const toConditionDTO = (condition: FilterConditionState): ParticleFilterConditionDTO | null => {
    const parsedValue = parseNumericInput(condition.valueInput);
    if (!condition.property || parsedValue === null) return null;
    return {
        property: condition.property,
        operator: condition.operator,
        value: parsedValue,
        ...(condition.exposureId ? { exposureId: condition.exposureId } : {})
    };
};

const toSceneCondition = (condition: ParticleFilterConditionDTO): ParticleFilterSceneCondition => {
    return {
        kind: 'property',
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
    const firstCondition = conditions[0];
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
        exposureId: firstCondition?.exposureId,
        property: firstCondition?.property,
        operator: firstCondition?.operator,
        value: firstCondition?.value
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

const useParticleFilter = (options: UseModifierBaseOptions = {}) => {
    const {
        trajectoryId,
        analysisId,
        currentTimestep,
        setActiveScene
    } = useModifierBase(options);
    const dataAccess = useCanvasDataAccess();
    const { properties, isLoading: isLoadingProperties } = useFrameProperties({
        trajectoryId,
        analysisId,
        timestep: currentTimestep
    });
    const propertyOptions = useMemo(() => buildPropertyOptions(properties), [properties]);

    const [uniqueValuesEnabled, setUniqueValuesEnabled] = useState(false);
    const [suggestionsConditionId, setSuggestionsConditionId] = useState<string | null>(null);
    const [matchMode, setMatchMode] = useState<ParticleFilterCombinator>(ParticleFilterCombinator.And);
    const [conditions, setConditions] = useState<FilterConditionState[]>(() => [createPropertyCondition([])]);
    const [action, setAction] = useState<FilterAction>(FilterAction.Delete);
    const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [isApplying, setIsApplying] = useState(false);

    const pendingEvaluationIdRef = useRef(0);

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

    const conditionSuggestions = useMemo(() => {
        return uniqueValuesResult.data?.values ?? [];
    }, [uniqueValuesResult.data]);

    const syncAllConditions = useCallback((currentConditions: FilterConditionState[]) => {
        if (currentConditions.length === 0) {
            return [createPropertyCondition(propertyOptions)];
        }
        return currentConditions.map((condition) => syncConditionWithPropertyOptions(condition, propertyOptions));
    }, [propertyOptions]);

    useEffect(() => {
        setConditions((currentConditions) => syncAllConditions(currentConditions));
    }, [syncAllConditions]);

    useEffect(() => {
        if (!uniqueValuesEnabled || !uniqueValuesResult.error) return;
        reportError(uniqueValuesResult.error, {
            surface: ErrorSurface.Toast,
            fallbackTitle: isAccessDeniedError(uniqueValuesResult.error)
                ? 'You do not have permission to perform this action.'
                : 'Failed to load suggestions'
        });
    }, [uniqueValuesEnabled, uniqueValuesResult.error]);

    const updateCondition = useCallback((conditionId: string, updater: (condition: FilterConditionState) => FilterConditionState) => {
        setConditions((currentConditions) => currentConditions.map((condition) => {
            if (condition.id !== conditionId) return condition;
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

    const handlePropertyChange = useCallback((conditionId: string, value: string) => {
        updateCondition(conditionId, (condition) => {
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
        updateCondition(conditionId, (condition) => ({
            ...condition,
            operator
        }));
    }, [updateCondition]);

    const handleValueChange = useCallback((conditionId: string, nextValue: string) => {
        updateCondition(conditionId, (condition) => {
            const parsedValue = parseNumericInput(nextValue);
            let value = condition.value;
            if (parsedValue !== null) value = parsedValue;
            return { ...condition, value, valueInput: nextValue };
        });
    }, [updateCondition]);

    const fetchValueSuggestions = useCallback((conditionId: string) => {
        const condition = conditions.find((currentCondition) => currentCondition.id === conditionId);
        if (!condition || !condition.property) return;
        setSuggestionsConditionId(conditionId);
        setUniqueValuesEnabled(true);
        sileo.info({ title: 'Loading suggestions...' });
    }, [conditions]);

    const buildPreviewRequest = useCallback((): PreviewRequest | null => {
        const nextConditions = conditions.map(toConditionDTO);
        if (nextConditions.some((condition) => condition === null)) return null;
        return {
            combinator: matchMode,
            conditions: nextConditions.filter((condition): condition is ParticleFilterConditionDTO => condition !== null)
        };
    }, [conditions, matchMode]);

    const runEvaluation = useCallback(async (request: PreviewRequest): Promise<PreviewResult | null> => {
        if (!trajectoryId || currentTimestep === undefined) return null;
        const evaluationId = ++pendingEvaluationIdRef.current;
        // Why: the daemon evaluates the filter against the dump file on the
        // compute cluster. We just ask for the match count and hand it to the
        // UI — no client-side CPU work, no binary atoms download.
        const response = await dataAccess.previewParticleFilter({
            trajectoryId,
            analysisId,
            timestep: currentTimestep,
            combinator: request.combinator,
            conditions: request.conditions
        });
        if (evaluationId !== pendingEvaluationIdRef.current) return null;

        return {
            matchCount: response.matchCount,
            totalCount: response.totalAtoms,
            request
        };
    }, [trajectoryId, currentTimestep, analysisId, dataAccess]);

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
        setError(null);
        setPreviewResult(null);
        setIsLoadingPreview(true);
        try {
            const result = await runEvaluation(request);
            if (!result) return;
            setPreviewResult(result);
        } catch (previewError: unknown) {
            setError(reportError(previewError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Preview failed'
            }).title);
        } finally {
            setIsLoadingPreview(false);
        }
    }, [trajectoryId, currentTimestep, buildPreviewRequest, runEvaluation]);

    const handleApplyAction = useCallback(async () => {
        if (!previewResult || !trajectoryId || currentTimestep === undefined) {
            setError('Run preview first');
            return;
        }
        setError(null);
        setIsApplying(true);
        try {
            await particleFilterService.applyAction({
                trajectoryId,
                analysisId,
                timestep: currentTimestep,
                action,
                combinator: previewResult.request.combinator,
                conditions: previewResult.request.conditions
            });
            setActiveScene(toScene(analysisId, action, previewResult.request));
            setPreviewResult(null);
        } catch (applyError: unknown) {
            setError(reportError(applyError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Failed to apply filter'
            }).title);
        } finally {
            setIsApplying(false);
        }
    }, [previewResult, trajectoryId, currentTimestep, analysisId, action, setActiveScene]);

    const handleCancelPreview = useCallback(() => {
        setPreviewResult(null);
        setError(null);
    }, []);

    const percentage = useMemo(() => {
        if (!previewResult || previewResult.totalCount === 0) return '0';
        return ((previewResult.matchCount / previewResult.totalCount) * 100).toFixed(2);
    }, [previewResult]);

    const canPreview = useMemo(() => {
        if (isLoadingPreview || isApplying || isLoadingProperties) return false;
        if (conditions.length === 0) return false;
        return conditions.every((condition) => toConditionDTO(condition) !== null);
    }, [isLoadingPreview, isApplying, isLoadingProperties, conditions]);

    return {
        conditions,
        addCondition,
        removeCondition,
        handlePropertyChange,
        handleOperatorChange,
        handleValueChange,
        propertyOptions,
        matchMode,
        setMatchMode,
        action,
        setAction,
        fetchValueSuggestions,
        getValueSuggestions: (conditionId: string) => {
            if (suggestionsConditionId !== conditionId) return [];
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
