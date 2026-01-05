import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAnalysisConfigStore } from '@/stores/slices/analysis';
import { useEditorStore } from '@/stores/slices/editor';
import { useTrajectoryStore } from '@/stores/slices/trajectory';
import useFrameProperties from '@/hooks/trajectory/use-frame-properties';
import useLogger from '@/hooks/core/use-logger';

export interface PropertyOption {
    value: string;
    title: string;
    exposureId: string | null;
}

// TODO: ANALYSIS CONFIG SHOULD NOT BE REQUIRED
const usePropertySelector = () => {
    const analysisConfig = useAnalysisConfigStore((state) => state.analysisConfig);
    const currentTimestep = useEditorStore((state) => state.currentTimestep);
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const setActiveScene = useEditorStore((state) => state.setActiveScene);
    const logger = useLogger('hooks/use-property-selector');

    const [property, setProperty] = useState('');
    const [exposureId, setExposureId] = useState<string | null>(null);

    const { properties, isLoading } = useFrameProperties({
        analysisId: analysisConfig?._id,
        trajectoryId: trajectory?._id,
        frame: currentTimestep
    });

    // Reset selected property when analysis changes
    useEffect(() => {
        setProperty('');
        setExposureId(null);
    }, [analysisConfig?._id]);

    const propertyOptions = useMemo<PropertyOption[]>(() => [
        ...properties.base.map((prop) => ({ value: prop, title: prop, exposureId: null })),
        ...Object.entries(properties.modifiers).flatMap(([expId, props]) =>
            props.map((prop) => ({ value: prop, title: prop, exposureId: expId }))
        )
    ], [properties]);

    useEffect(() => {
        logger.log('properties:', properties, 'isLoading:', isLoading, 'analysisConfig:', analysisConfig, 'trajectory:', trajectory, 'frame:', currentTimestep, 'propertyOptions:', propertyOptions);
    }, [properties, isLoading, analysisConfig, trajectory, currentTimestep, propertyOptions]);


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
