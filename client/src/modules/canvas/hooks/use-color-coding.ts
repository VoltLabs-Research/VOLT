import { UseModifierBaseOptions } from './use-modifier-base';
import useModifierBase from './use-modifier-base';
import { parseNumericInput } from '../utilities/parse-numeric-input';
import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';
import { colorCodingStatsQuery } from '@/modules/trajectory/hooks/color-coding/queries';
import { COLORMAP_NAMES, type ColormapName } from '@/modules/fractal/services/colormaps';
import colorCodingService from '@/modules/trajectory/api/services/color-coding';
import { useState, useEffect, useCallback, useMemo } from 'react';

import type { ColorCodingScene } from '@/modules/fractal/api/entities/scene';

export { COLORMAP_NAMES };
export type ColorGradient = ColormapName;

const DEFAULT_GRADIENT: ColorGradient = 'Viridis';

const isColorGradient = (value: string): value is ColorGradient => {
    return (COLORMAP_NAMES as ReadonlyArray<string>).includes(value);
};

const useColorCoding = (options: UseModifierBaseOptions = {}) => {
    const {
        trajectoryId,
        analysisId,
        currentTimestep,
        property,
        propertyValue,
        exposureId,
        propertyOptions,
        isLoading: isLoadingProperties,
        handlePropertyChange,
        setActiveScene
    } = useModifierBase(options);

    const [startValue, setStartValue] = useState(0);
    const [startValueInput, setStartValueInput] = useState('0');
    const [endValue, setEndValue] = useState(1);
    const [endValueInput, setEndValueInput] = useState('1');
    const [gradient, setGradient] = useState<ColorGradient>(DEFAULT_GRADIENT);
    const [automaticRange, setAutomaticRange] = useState(true);
    const [symmetricRange, setSymmetricRange] = useState(false);
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
        if (parsedValue !== null) setStartValue(parsedValue);
    }, []);

    const handleEndValueChange = useCallback((nextValue: string) => {
        setEndValueInput(nextValue);
        const parsedValue = parseNumericInput(nextValue);
        if (parsedValue !== null) setEndValue(parsedValue);
    }, []);

    const statsType = exposureId ? 'modifier' : 'base';
    const canFetchStats = !!property && !!trajectoryId && currentTimestep !== undefined
        && (statsType !== 'modifier' || !!analysisId);

    const statsQuery = colorCodingStatsQuery(
        {
            trajectoryId: trajectoryId!,
            analysisId,
            timestep: currentTimestep!,
            property: property!,
            type: statsType,
            exposureId: exposureId ?? undefined
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
            await colorCodingService.apply({
                trajectoryId,
                analysisId,
                timestep: currentTimestep,
                payload: {
                    property,
                    startValue,
                    endValue,
                    gradient,
                    ...(exposureId ? { exposureId } : {})
                }
            });

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

            // Why: the right-panel artifact tree listens for this event to
            // refetch color-coding/particle-filter lists. Without it the user
            // has to reload the page to see the entry they just created.
            window.dispatchEvent(new CustomEvent('canvas:scene-artifacts:changed', {
                detail: { trajectoryId }
            }));
        } catch (error: unknown) {
            if (isAccessDeniedError(error)) return;
            reportError(error, {
                surface: ErrorSurface.Toast,
                fallbackTitle: 'Failed to apply color coding'
            });
        } finally {
            setIsApplying(false);
        }
    }, [trajectoryId, currentTimestep, property, gradient, startValue, endValue, analysisId, exposureId, setActiveScene]);

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
        COLORMAP_NAMES.map((color) => ({ value: color, title: color })), []);

    const handleGradientChange = useCallback((value: string) => {
        if (isColorGradient(value)) setGradient(value);
    }, []);

    const canApply = useMemo(() =>
        !isLoadingProperties && !isFetchingStats && !isApplying && hasValidRange,
        [isLoadingProperties, isFetchingStats, isApplying, hasValidRange]);

    return {
        property,
        propertyValue,
        propertyOptions,
        handlePropertyChange,
        isLoadingProperties,
        gradient,
        setGradient: handleGradientChange,
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
