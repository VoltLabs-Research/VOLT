import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams } from 'react-router';
import { useAnalysisStore } from '@/modules/analysis/presentation/stores';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import { useTrajectory } from '@/modules/trajectory/presentation/hooks/use-trajectory-queries';
import useFrameProperties from '@/modules/trajectory/presentation/hooks/use-frame-properties';
import useLogger from '@/shared/presentation/hooks/core/use-logger';

export interface PropertyOption {
    value: string;
    title: string;
    exposureId: string | null;
}

const usePropertySelector = () => {
    const { trajectoryId } = useParams<{ trajectoryId: string }>();
    const { data: trajectory } = useTrajectory(trajectoryId!);
    const analysisConfig = useAnalysisStore((state) => state.analysisConfig);
    const currentTimestep = useEditorStore((state) => state.currentTimestep);
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
