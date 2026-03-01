import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useModifierBase, { UseModifierBaseOptions } from './use-modifier-base';
import useColorCodingUseCases from '@/modules/trajectory/presentation/hooks/color-coding/use-color-coding-use-cases';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';

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

    const { colorCodingRepository } = useColorCodingUseCases();

    const [startValue, setStartValue] = useState(0);
    const [endValue, setEndValue] = useState(0);
    const [gradient, setGradient] = useState<ColorGradient>('Viridis');
    const [automaticRange, setAutomaticRange] = useState(true);
    const [symmetricRange, setSymmetricRange] = useState(true);
    const [isFetchingStats, setIsFetchingStats] = useState(false);
    const [isApplying, setIsApplying] = useState(false);

    // Refs for values used inside fetchStats but that should NOT trigger re-fetches
    const propertyOptionsRef = useRef(propertyOptions);
    propertyOptionsRef.current = propertyOptions;

    const fetchStats = useCallback(async () => {
        if (!property || !trajectoryId) return;

        const selectedOption = propertyOptionsRef.current.find((opt) => opt.value === property);
        const type = selectedOption?.exposureId ? 'modifier' : 'base';

        if (type === 'modifier' && !analysisId) return;

        setIsFetchingStats(true);
        try {
            const stats = await colorCodingRepository.getStats({
                    trajectoryId, analysisId, timestep: currentTimestep,
                    property, type, exposureId: selectedOption?.exposureId
                });
            setStartValue(stats.min);
            setEndValue(stats.max);
        } catch (error) {
            console.error(error);
            sileo.error({ title: 'Failed to fetch property statistics' });
        } finally {
            setIsFetchingStats(false);
        }
    }, [trajectoryId, analysisId, currentTimestep, property, colorCodingRepository]);

    const applyColorCoding = useCallback(async () => {
        if (!trajectoryId || currentTimestep === undefined || !property) return;
        
        setIsApplying(true);
        try {
            await showPromise(
                colorCodingRepository.apply({
                    trajectoryId, analysisId, timestep: currentTimestep,
                    payload: { property, startValue, endValue, gradient, exposureId }
                }),
                {
                    loading: { title: 'Applying color coding...' },
                    success: { title: 'Color coding applied successfully' },
                    error: { title: 'Failed to apply color coding' }
                }
            );

            setActiveScene({
                analysisId, endValue: String(endValue), exposureId,
                gradient, property, source: 'color-coding', startValue: String(startValue),
                sceneType: 'color-coding'
            } as any);

            window.dispatchEvent(new CustomEvent('canvas:scene-artifacts:changed', {
                detail: { sourceType: 'color-coding', trajectoryId }
            }));
        } finally {
            setIsApplying(false);
        }
    }, [trajectoryId, analysisId, currentTimestep, property, startValue, endValue, gradient, exposureId, colorCodingRepository, setActiveScene]);

    useEffect(() => {
        if (automaticRange) fetchStats();
    }, [automaticRange, currentTimestep, property, exposureId, fetchStats]);

    useEffect(() => {
        if (!symmetricRange) return;
        if (endValue === 0 && !automaticRange) {
            setAutomaticRange(true);
            return;
        }
        const limit = Math.max(Math.abs(startValue), Math.abs(endValue));
        if (startValue !== -limit || endValue !== limit) {
            setStartValue(-limit);
            setEndValue(limit);
        }
    }, [symmetricRange, endValue, startValue, automaticRange]);

    const gradientOptions = useMemo(() => 
        COLOR_GRADIENTS.map((color) => ({ value: color, title: color })), []);

    const canApply = useMemo(() => 
        !isLoadingProperties && !isFetchingStats && !isApplying, 
        [isLoadingProperties, isFetchingStats, isApplying]);

    return {
        property, propertyOptions, handlePropertyChange, isLoadingProperties,
        gradient, setGradient, gradientOptions,
        startValue, setStartValue, endValue, setEndValue,
        automaticRange, setAutomaticRange, symmetricRange, setSymmetricRange,
        isFetchingStats, isApplying, canApply,
        applyColorCoding, fetchStats
    };
};

export default useColorCoding;
