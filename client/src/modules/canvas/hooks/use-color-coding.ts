import { UseModifierBaseOptions } from './use-modifier-base';
import useModifierBase from './use-modifier-base';
import { parseNumericInput } from '../utilities/parse-numeric-input';
import { isAccessDeniedError } from '@/shared/errors/core';

import { useApplyColorCodingMutation, colorCodingStatsQuery } from '@/modules/trajectory/hooks/color-coding/queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useState, useEffect, useCallback, useMemo } from 'react';

import type { ColorCodingScene } from '@/modules/fractal/api/entities/scene';

export const COLOR_GRADIENTS = ['Viridis', 'Plasma', 'BlueRed', 'GrayScale'] as const;
export type ColorGradient = typeof COLOR_GRADIENTS[number];

const useColorCoding = (options: UseModifierBaseOptions = {}) => {
    const {
        trajectoryId,
        analysisId,
        currentTimestep,
        property,
        exposureId,
        propertyOptions,
        isLoading: isLoadingProperties,
        handlePropertyChange,
        setActiveScene
    } = useModifierBase(options);

    const applyMutation = useApplyColorCodingMutation();

    const [startValue, setStartValue] = useState(0);
    const [startValueInput, setStartValueInput] = useState('0');
    const [endValue, setEndValue] = useState(0);
    const [endValueInput, setEndValueInput] = useState('0');
    const [gradient, setGradient] = useState<ColorGradient>('Viridis');
    const [automaticRange, setAutomaticRange] = useState(true);
    const [symmetricRange, setSymmetricRange] = useState(true);
    const [isApplying, setIsApplying] = useState(false);

    const syncStartValue = useCallback((nextValue: number) => {
        setStartValue(nextValue);
        setStartValueInput(String(nextValue));
    }, []);

    const syncEndValue = useCallback((nextValue: number) => {
        setEndValue(nextValue);
        setEndValueInput(String(nextValue));
    }, []);

    const handleStartValueChange = useCallback((nextValue: string) => {
        setStartValueInput(nextValue);

        const parsedValue = parseNumericInput(nextValue);
        if (parsedValue !== null) {
            setStartValue(parsedValue);
        }
    }, []);

    const handleEndValueChange = useCallback((nextValue: string) => {
        setEndValueInput(nextValue);

        const parsedValue = parseNumericInput(nextValue);
        if (parsedValue !== null) {
            setEndValue(parsedValue);
        }
    }, []);

    const selectedOption = useMemo(() =>
        propertyOptions.find((opt) => opt.value === property),
        [propertyOptions, property]
    );

    const statsType = selectedOption?.exposureId ? 'modifier' : 'base';
    const canFetchStats = !!property && !!trajectoryId && currentTimestep !== undefined
        && (statsType !== 'modifier' || !!analysisId);

    const statsQuery = colorCodingStatsQuery(
        {
            trajectoryId: trajectoryId!,
            analysisId,
            timestep: currentTimestep!,
            property: property!,
            type: statsType,
            exposureId: selectedOption?.exposureId ?? undefined
        },
        { enabled: automaticRange && canFetchStats }
    );

    const isFetchingStats = statsQuery.isLoading || statsQuery.isFetching;

    useEffect(() => {
        if (statsQuery.data) {
            syncStartValue(statsQuery.data.min);
            syncEndValue(statsQuery.data.max);
        }
    }, [statsQuery.data, syncEndValue, syncStartValue]);

    const applyColorCoding = useCallback(async () => {
        if (!trajectoryId || currentTimestep === undefined || !property) return;

        setIsApplying(true);
        try {
            await showPromise(
                applyMutation.mutateAsync({
                    trajectoryId,
                    analysisId,
                    timestep: currentTimestep,
                    payload: {
                        property,
                        startValue,
                        endValue,
                        gradient,
                        exposureId: exposureId ?? undefined
                    }
                }),
                {
                    loading: { title: 'Applying color coding...' },
                    success: { title: 'Color coding applied successfully' },
                    error: { title: 'Failed to apply color coding' }
                }
            );

            setActiveScene({
                analysisId,
                endValue: String(endValue),
                exposureId: exposureId ?? '',
                gradient,
                property,
                source: 'color-coding',
                startValue: String(startValue),
                sceneType: 'color-coding'
            } as ColorCodingScene);

            window.dispatchEvent(new CustomEvent('canvas:scene-artifacts:changed', {
                detail: {
                    sourceType: 'color-coding',
                    trajectoryId
                }
            }));
        } catch (error: unknown) {
            if (isAccessDeniedError(error)) return;
        } finally {
            setIsApplying(false);
        }
    }, [trajectoryId, analysisId, currentTimestep, property, startValue, endValue, gradient, exposureId, applyMutation, setActiveScene]);

    useEffect(() => {
        if (!symmetricRange) return;
        if (endValue === 0 && !automaticRange) {
            setAutomaticRange(true);
            return;
        }
        const limit = Math.max(Math.abs(startValue), Math.abs(endValue));
        if (startValue !== -limit || endValue !== limit) {
            syncStartValue(-limit);
            syncEndValue(limit);
        }
    }, [symmetricRange, endValue, startValue, automaticRange, syncEndValue, syncStartValue]);

    const hasValidRange = useMemo(() => {
        return parseNumericInput(startValueInput) !== null && parseNumericInput(endValueInput) !== null;
    }, [startValueInput, endValueInput]);

    const gradientOptions = useMemo(() =>
        COLOR_GRADIENTS.map((color) => ({
            value: color,
            title: color
        })), []);

    const canApply = useMemo(() =>
        !isLoadingProperties && !isFetchingStats && !isApplying && hasValidRange,
        [isLoadingProperties, isFetchingStats, isApplying, hasValidRange]);

    return {
        property,
        propertyOptions,
        handlePropertyChange,
        isLoadingProperties,
        gradient,
        setGradient,
        gradientOptions,
        startValue,
        startValueInput,
        setStartValue: handleStartValueChange,
        endValue,
        endValueInput,
        setEndValue: handleEndValueChange,
        automaticRange,
        setAutomaticRange,
        symmetricRange,
        setSymmetricRange,
        isFetchingStats,
        isApplying,
        canApply,
        applyColorCoding,
        refetchStats: statsQuery.refetch
    };
};

export default useColorCoding;
