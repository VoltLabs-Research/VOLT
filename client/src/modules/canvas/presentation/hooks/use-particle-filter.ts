import { useState, useCallback, useMemo } from 'react';
import useModifierBase, { UseModifierBaseOptions } from './use-modifier-base';
import useParticleFilterUseCases from '@/modules/trajectory/presentation/hooks/particle-filter/use-particle-filter-use-cases';
import useAsyncAction from '@/shared/presentation/hooks/use-async-action';
import { showPromise } from '@/shared/presentation/hooks/toast';

export type FilterOperator = '==' | '!=' | '>' | '>=' | '<' | '<=';
export type FilterAction = 'delete' | 'highlight';

export const OPERATORS: { value: FilterOperator; title: string }[] = [
    { value: '==', title: '=' },
    { value: '!=', title: '!=' },
    { value: '>', title: '>' },
    { value: '>=', title: '>=' },
    { value: '<', title: '<' },
    { value: '<=', title: '<=' }
];

export const ACTIONS: { value: FilterAction; title: string }[] = [
    { value: 'delete', title: 'Delete' },
    { value: 'highlight', title: 'Color Selection' }
];

export interface PreviewResult {
    matchCount: number;
    totalCount: number;
    filterParams: {
        property: string;
        operator: FilterOperator;
        value: number;
        exposureId?: string;
    };
}

const useParticleFilter = (options: UseModifierBaseOptions = {}) => {
    const {
        trajectoryId,
        analysisId,
        currentTimestep,
        property,
        exposureId,
        propertyOptions,
        isLoading: isLoadingProperties,
        handlePropertyChange: baseHandlePropertyChange,
        setActiveScene
    } = useModifierBase(options);

    const { particleFilterRepository } = useParticleFilterUseCases();

    const [operator, setOperator] = useState<FilterOperator>('==');
    const [value, setValue] = useState(0);
    const [action, setAction] = useState<FilterAction>('delete');
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [valueSuggestions, setValueSuggestions] = useState<number[]>([]);
    const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const previewAction = useAsyncAction({
        onError: (err: unknown) => setError((err as any).message),
        onFinally: () => setIsLoadingPreview(false)
    });

    const applyAction = useAsyncAction({
        onError: (err: unknown) => setError((err as any).message),
        onFinally: () => setIsApplying(false)
    });

    const handlePropertyChange = useCallback((newValue: string) => {
        baseHandlePropertyChange(newValue);
        setPreviewResult(null);
        setError(null);
        setValueSuggestions([]);
    }, [baseHandlePropertyChange]);

    const fetchValueSuggestions = useCallback(async () => {
        if (!property || !trajectoryId || currentTimestep === undefined) return;
        const normalizedExposureId = exposureId ?? undefined;

        try {
            const result = await particleFilterRepository.getUniqueValues({
                trajectoryId, analysisId, timestep: currentTimestep,
                property, exposureId: normalizedExposureId, maxValues: 50
            });
            setValueSuggestions(result.values);
        } catch (err) {
            console.error('Failed to fetch suggestions:', err);
        }
    }, [trajectoryId, currentTimestep, property, analysisId, exposureId, particleFilterRepository]);

    const handlePreview = useCallback(async () => {
        if (!property || !trajectoryId || currentTimestep === undefined) {
            setError('Missing required parameters');
            return;
        }

        const selectedOption = propertyOptions.find((opt) => opt.value === property);
        if (selectedOption?.exposureId && !analysisId) {
            setError('Analysis required for modifier properties');
            return;
        }

        setIsLoadingPreview(true);
        setError(null);
        setPreviewResult(null);
        const normalizedExposureId = exposureId ?? undefined;

        await previewAction.execute(async () => {
            const result = await particleFilterRepository.preview({
                trajectoryId, analysisId, timestep: currentTimestep,
                property,
                operator,
                value,
                exposureId: normalizedExposureId
            });
            setPreviewResult({
                matchCount: result.matchCount,
                totalCount: result.totalAtoms,
                filterParams: { property, operator, value, exposureId: normalizedExposureId }
            });
        });
    }, [trajectoryId, analysisId, currentTimestep, property, operator, value, exposureId, propertyOptions, particleFilterRepository, previewAction]);

    const handleApplyAction = useCallback(async () => {
        if (!previewResult || !trajectoryId || currentTimestep === undefined) {
            setError('Run preview first');
            return;
        }

        setIsApplying(true);
        setError(null);

        await applyAction.execute(async () => {
            const { filterParams } = previewResult;
            await showPromise(
                particleFilterRepository.applyAction({
                    trajectoryId, analysisId, timestep: currentTimestep,
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

            setActiveScene({
                sceneType: 'particle-filter',
                source: 'particle-filter',
                analysisId,
                property: filterParams.property,
                operator: filterParams.operator,
                value: filterParams.value,
                action,
                exposureId: filterParams.exposureId
            } as any);

            window.dispatchEvent(new CustomEvent('canvas:scene-artifacts:changed', {
                detail: { sourceType: 'particle-filter', trajectoryId }
            }));

            setPreviewResult(null);
        });
    }, [trajectoryId, analysisId, currentTimestep, action, previewResult, setActiveScene, particleFilterRepository, applyAction]);

    const handleCancelPreview = useCallback(() => {
        setPreviewResult(null);
        setError(null);
    }, []);

    const percentage = useMemo(() => {
        if (!previewResult) return '0';
        return ((previewResult.matchCount / previewResult.totalCount) * 100).toFixed(2);
    }, [previewResult]);

    const canPreview = useMemo(() => {
        return !isLoadingPreview && !isApplying && !!property && !isLoadingProperties;
    }, [isLoadingPreview, isApplying, property, isLoadingProperties]);

    return {
        property, propertyOptions, handlePropertyChange, isLoadingProperties,
        operator, setOperator, value, setValue, action, setAction,
        valueSuggestions, fetchValueSuggestions,
        previewResult, isLoadingPreview, handlePreview, handleCancelPreview, percentage, canPreview,
        isApplying, handleApplyAction, error
    };
};

export default useParticleFilter;
