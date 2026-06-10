import useModifierBase from './use-modifier-base';
import { FilterAction, FilterOperator } from './use-particle-filter';
import { ParticleFilterSceneCombinator } from '@/modules/fractal/api/entities/scene';
import useFrameProperties from '@/modules/trajectory/hooks/particle-filter/use-frame-properties';
import { buildPropertyOptions } from '@/modules/trajectory/hooks/particle-filter/use-property-selector.utilities';
import { uniqueValuesQuery } from '@/modules/trajectory/hooks/particle-filter/queries';
import particleFilterService, { ParticleFilterCombinator } from '@/modules/trajectory/api/services/particle-filter-service';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import { useCanvasDataAccess } from '@/modules/canvas/api/access';
import { useCallback, useMemo, useRef, useState } from 'react';

import type { ParticleFilterScene } from '@/modules/fractal/api/entities/scene';
import type { ParticleFilterConditionDTO } from '@/modules/trajectory/api/services/particle-filter-service';
import type { PropertyOption } from '@/modules/trajectory/hooks/particle-filter/use-property-selector.utilities';
import type { UseModifierBaseOptions } from './use-modifier-base';

interface PreviewResult {
    matchCount: number;
    totalCount: number;
    conditions: ParticleFilterConditionDTO[];
}

const STRUCTURE_PROPERTY = 'structure_name';

const toScene = (
    analysisId: string | undefined,
    action: FilterAction,
    conditions: ParticleFilterConditionDTO[]
): ParticleFilterScene => {
    const firstCondition = conditions[0];
    return {
        sceneType: 'particle-filter',
        source: 'particle-filter',
        analysisId,
        action,
        combinator: ParticleFilterSceneCombinator.Or,
        conditions: conditions.map((condition) => ({
            kind: 'property' as const,
            property: condition.property,
            operator: condition.operator,
            value: condition.value,
            ...(condition.exposureId ? { exposureId: condition.exposureId } : {})
        })),
        exposureId: firstCondition?.exposureId,
        property: firstCondition?.property,
        operator: firstCondition?.operator,
        value: firstCondition?.value
    };
};

const useStructureTypeSelect = (options: UseModifierBaseOptions = {}) => {
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

    // One option per exposure that publishes a string structure_name column
    // (PTM, ACNA, DXA structure identification, ...).
    const sourceOptions = useMemo(() => {
        return buildPropertyOptions(properties).filter((option) => (
            option.type === 'string' && option.property === STRUCTURE_PROPERTY
        ));
    }, [properties]);

    const [sourceValue, setSourceValue] = useState<string | null>(null);
    const source = useMemo<PropertyOption | null>(() => {
        return sourceOptions.find((option) => option.value === sourceValue) ?? sourceOptions[0] ?? null;
    }, [sourceOptions, sourceValue]);

    const typesParams = useMemo(() => {
        if (!source || !trajectoryId || currentTimestep === undefined) {
            return null;
        }
        return {
            trajectoryId,
            analysisId,
            timestep: currentTimestep,
            property: source.property,
            exposureId: source.exposureId ?? undefined,
            maxValues: 50
        };
    }, [source, trajectoryId, analysisId, currentTimestep]);

    const typesResult = uniqueValuesQuery(
        typesParams ?? { trajectoryId: '', timestep: 0, property: '' },
        {
            enabled: Boolean(typesParams),
            retry: false,
            staleTime: 5 * 60 * 1000
        }
    );
    const structureTypes = useMemo(() => {
        return (typesResult.data?.values ?? []).map(String);
    }, [typesResult.data]);

    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const [action, setAction] = useState<FilterAction>(FilterAction.Delete);
    const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const pendingEvaluationIdRef = useRef(0);

    const selectedTypes = useMemo(() => {
        return structureTypes.filter((typeName) => selected[typeName]);
    }, [structureTypes, selected]);

    const toggleType = useCallback((typeName: string) => {
        setSelected((current) => ({ ...current, [typeName]: !current[typeName] }));
        setPreviewResult(null);
        setError(null);
    }, []);

    const handleSourceChange = useCallback((value: string) => {
        setSourceValue(value);
        setSelected({});
        setPreviewResult(null);
        setError(null);
    }, []);

    const handleActionChange = useCallback((nextAction: FilterAction) => {
        setAction(nextAction);
    }, []);

    const buildConditions = useCallback((): ParticleFilterConditionDTO[] => {
        return selectedTypes.map((typeName) => ({
            property: STRUCTURE_PROPERTY,
            operator: FilterOperator.Equal,
            value: typeName,
            ...(source?.exposureId ? { exposureId: source.exposureId } : {})
        }));
    }, [selectedTypes, source]);

    const handlePreview = useCallback(async () => {
        if (!trajectoryId || currentTimestep === undefined) {
            setError('Missing required parameters');
            return;
        }
        const conditions = buildConditions();
        if (conditions.length === 0) {
            setError('Select at least one structure type');
            return;
        }
        setError(null);
        setPreviewResult(null);
        setIsLoadingPreview(true);
        try {
            const evaluationId = ++pendingEvaluationIdRef.current;
            const response = await dataAccess.previewParticleFilter({
                trajectoryId,
                analysisId,
                timestep: currentTimestep,
                combinator: ParticleFilterCombinator.Or,
                conditions
            });
            if (evaluationId !== pendingEvaluationIdRef.current) return;
            setPreviewResult({
                matchCount: response.matchCount,
                totalCount: response.totalAtoms,
                conditions
            });
        } catch (previewError: unknown) {
            setError(reportError(previewError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Preview failed'
            }).title);
        } finally {
            setIsLoadingPreview(false);
        }
    }, [trajectoryId, currentTimestep, analysisId, buildConditions, dataAccess]);

    const handleApply = useCallback(async () => {
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
                combinator: ParticleFilterCombinator.Or,
                conditions: previewResult.conditions
            });
            setActiveScene(toScene(analysisId, action, previewResult.conditions));
            setPreviewResult(null);

            window.dispatchEvent(new CustomEvent('canvas:scene-artifacts:changed', {
                detail: { trajectoryId }
            }));
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

    return {
        hasStructureSource: sourceOptions.length > 0,
        sourceOptions,
        sourceValue: source?.value ?? '',
        handleSourceChange,
        structureTypes,
        isLoadingTypes: isLoadingProperties || typesResult.isFetching,
        selected,
        selectedTypes,
        toggleType,
        action,
        handleActionChange,
        previewResult,
        isLoadingPreview,
        handlePreview,
        handleCancelPreview,
        percentage,
        canPreview: selectedTypes.length > 0 && !isLoadingPreview && !isApplying,
        isApplying,
        handleApply,
        error
    };
};

export default useStructureTypeSelect;
