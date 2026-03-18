import { UseModifierBaseOptions } from './use-modifier-base';
import useModifierBase from './use-modifier-base';
import { parseNumericInput } from '../utilities/parse-numeric-input';

import { useApplyFilterMutation, uniqueValuesQuery, usePreviewFilterMutation } from '@/modules/trajectory/hooks/particle-filter/queries';
import { ErrorSurface, isAccessDeniedError, normalizeError, reportError } from '@/shared/errors/core';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useCallback, useMemo, useState } from 'react';
import { sileo } from 'sileo';

import type { ParticleFilterScene } from '@/modules/fractal/api/entities/scene';

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

interface PreviewFilterParams {
    property: string;
    operator: FilterOperator;
    value: number;
    exposureId?: string;
};

export interface PreviewResult {
    matchCount: number;
    totalCount: number;
    filterParams: PreviewFilterParams;
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

const useParticleFilter = (options: UseModifierBaseOptions = {}) => {
    const {
        trajectoryId,
        analysisId,
        currentTimestep,
        property,
        propertyValue,
        exposureId,
        propertyOptions,
        isLoading: isLoadingProperties,
        handlePropertyChange: baseHandlePropertyChange,
        setActiveScene
    } = useModifierBase(options);

    const previewMutation = usePreviewFilterMutation();
    const applyFilterMutation = useApplyFilterMutation();
    const [uniqueValuesEnabled, setUniqueValuesEnabled] = useState(false);

    const [operator, setOperator] = useState<FilterOperator>(FilterOperator.Equal);
    const [value, setValue] = useState(0);
    const [valueInput, setValueInput] = useState('0');
    const [action, setAction] = useState<FilterAction>(FilterAction.Delete);
    const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const uniqueValuesParams = useMemo(() => {
        if (!property || !trajectoryId || currentTimestep === undefined) {
            return null;
        }

        return {
            trajectoryId,
            analysisId,
            timestep: currentTimestep,
            property,
            exposureId: exposureId ?? undefined,
            maxValues: 50
        };
    }, [trajectoryId, analysisId, currentTimestep, property, exposureId]);

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

    const valueSuggestions = uniqueValuesResult.data?.values ?? [];
    const isLoadingValueSuggestions = uniqueValuesResult.isFetching;

    const isLoadingPreview = previewMutation.isPending;
    const isApplying = applyFilterMutation.isPending;

    const handleValueChange = useCallback((nextValue: string) => {
        setValueInput(nextValue);
        setError(null);

        const parsedValue = parseNumericInput(nextValue);
        if (parsedValue !== null) {
            setValue(parsedValue);
        }
    }, []);

    const handlePropertyChange = useCallback((newValue: string) => {
        baseHandlePropertyChange(newValue);
        setPreviewResult(null);
        setError(null);
        setUniqueValuesEnabled(false);
    }, [baseHandlePropertyChange]);

    const fetchValueSuggestions = useCallback(async () => {
        if (!uniqueValuesParams) return;

        sileo.info({ title: 'Loading suggestions...' });
        setUniqueValuesEnabled(true);

        try {
            const result = await uniqueValuesResult.refetch();
            if (result.error) {
                throw result.error;
            }
        } catch (fetchError: unknown) {
            reportError(fetchError, {
                surface: ErrorSurface.Toast,
                fallbackTitle: isAccessDeniedError(fetchError)
                    ? 'You do not have permission to perform this action.'
                    : 'Failed to load suggestions'
            });
        }
    }, [uniqueValuesParams, uniqueValuesResult]);

    const handlePreview = useCallback(async () => {
        if (!property || !trajectoryId || currentTimestep === undefined) {
            setError('Missing required parameters');
            return;
        }

        const parsedValue = parseNumericInput(valueInput);
        if (parsedValue === null) {
            setError('Enter a valid numeric value');
            return;
        }

        if (exposureId && !analysisId) {
            setError('Analysis required for modifier properties');
            return;
        }

        setError(null);
        setPreviewResult(null);
        sileo.info({ title: 'Generating preview...' });
        const normalizedExposureId = exposureId ?? undefined;

        try {
            const result = await previewMutation.mutateAsync({
                trajectoryId,
                analysisId,
                timestep: currentTimestep,
                property,
                operator,
                value: parsedValue,
                exposureId: normalizedExposureId
            });

            setPreviewResult({
                matchCount: result.matchCount,
                totalCount: result.totalAtoms,
                filterParams: {
                    property,
                    operator,
                    value: parsedValue,
                    exposureId: normalizedExposureId
                }
            });
            sileo.success({ title: 'Preview generated' });
        } catch (previewError: unknown) {
            setError(reportError(previewError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Preview failed'
            }).title);
        }
    }, [trajectoryId, analysisId, currentTimestep, property, operator, valueInput, exposureId, propertyOptions, previewMutation]);

    const handleApplyAction = useCallback(async () => {
        if (!previewResult || !trajectoryId || currentTimestep === undefined) {
            setError('Run preview first');
            return;
        }

        setError(null);

        try {
            const { filterParams } = previewResult;
            await showPromise(
                applyFilterMutation.mutateAsync({
                    trajectoryId,
                    analysisId,
                    timestep: currentTimestep,
                    property: filterParams.property,
                    operator: filterParams.operator,
                    value: filterParams.value,
                    exposureId: filterParams.exposureId,
                    action
                }),
                {
                    loading: { title: 'Applying filter...' },
                    success: { title: 'Filter applied successfully' },
                    error: { title: 'Failed to apply filter' }
                }
            );

            const nextScene: ParticleFilterScene = {
                sceneType: 'particle-filter',
                source: 'particle-filter',
                analysisId,
                property: filterParams.property,
                operator: filterParams.operator,
                value: filterParams.value,
                action,
                exposureId: filterParams.exposureId
            };
            setActiveScene(nextScene);

            window.dispatchEvent(new CustomEvent('canvas:scene-artifacts:changed', {
                detail: {
                    sourceType: 'particle-filter',
                    trajectoryId
                }
            }));

            setPreviewResult(null);
        } catch (applyError: unknown) {
            setError(normalizeError(applyError).friendlyMessage);
        }
    }, [trajectoryId, analysisId, currentTimestep, action, previewResult, setActiveScene, applyFilterMutation]);

    const handleCancelPreview = useCallback(() => {
        setPreviewResult(null);
        setError(null);
    }, []);

    const percentage = useMemo(() => {
        if (!previewResult) return '0';
        return ((previewResult.matchCount / previewResult.totalCount) * 100).toFixed(2);
    }, [previewResult]);

    const canPreview = useMemo(() => {
        return !isLoadingPreview
            && !isApplying
            && !!property
            && !isLoadingProperties
            && parseNumericInput(valueInput) !== null;
    }, [isLoadingPreview, isApplying, property, isLoadingProperties, valueInput]);

    return {
        property,
        propertyValue,
        propertyOptions,
        handlePropertyChange,
        isLoadingProperties,
        operator,
        setOperator,
        value,
        valueInput,
        setValue: handleValueChange,
        action,
        setAction,
        valueSuggestions,
        fetchValueSuggestions,
        isLoadingValueSuggestions,
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
