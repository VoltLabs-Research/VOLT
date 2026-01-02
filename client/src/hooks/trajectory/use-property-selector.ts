/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 */

import { useState, useMemo, useCallback } from 'react';
import { useAnalysisConfigStore } from '@/stores/slices/analysis';
import { useEditorStore } from '@/stores/slices/editor';
import { useTrajectoryStore } from '@/stores/slices/trajectory';
import useFrameProperties from '@/hooks/trajectory/use-frame-properties';

export interface PropertyOption {
    value: string;
    title: string;
    exposureId: string | null;
}

const usePropertySelector = () => {
    const analysisConfig = useAnalysisConfigStore((state) => state.analysisConfig);
    const currentTimestep = useEditorStore((state) => state.currentTimestep);
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const setActiveScene = useEditorStore((state) => state.setActiveScene);

    const [property, setProperty] = useState('');
    const [exposureId, setExposureId] = useState<string | null>(null);

    const { properties, isLoading } = useFrameProperties({
        analysisId: analysisConfig?._id,
        trajectoryId: trajectory?._id,
        frame: currentTimestep
    });

    const propertyOptions = useMemo<PropertyOption[]>(() => [
        ...properties.base.map((prop) => ({ value: prop, title: prop, exposureId: null })),
        ...Object.entries(properties.modifiers).flatMap(([expId, props]) =>
            props.map((prop) => ({ value: prop, title: prop, exposureId: expId }))
        )
    ], [properties]);

    const handlePropertyChange = useCallback((value: string) => {
        setProperty(value);
        const selectedOption = propertyOptions.find((opt) => opt.value === value);
        setExposureId(selectedOption?.exposureId || null);
    }, [propertyOptions]);

    return {
        property,
        exposureId,
        propertyOptions,
        isLoading,
        handlePropertyChange,
        trajectory,
        analysisConfig,
        currentTimestep,
        setActiveScene
    };
};

export default usePropertySelector;
