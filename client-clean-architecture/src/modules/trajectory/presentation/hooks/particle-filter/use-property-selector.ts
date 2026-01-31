import { useState, useCallback, useMemo } from 'react';
import useFrameProperties from './use-frame-properties';

export interface PropertyOption{
    value: string;
    title: string;
    exposureId: string | null;
};

interface UsePropertySelectorParams{
    trajectoryId?: string;
    analysisId?: string;
    timestep?: number;
};

interface UsePropertySelectorResult{
    property: string;
    exposureId: string | null;
    propertyOptions: PropertyOption[];
    isLoading: boolean;
    handlePropertyChange: (value: string) => void;
};

const usePropertySelector = (params: UsePropertySelectorParams): UsePropertySelectorResult => {
    const { trajectoryId, analysisId, timestep } = params;
    const [selectedProperty, setSelectedProperty] = useState<string>('');
    const [selectedExposureId, setSelectedExposureId] = useState<string | null>(null);

    const { properties, isLoading } = useFrameProperties({
        trajectoryId,
        analysisId,
        timestep
    });

    const propertyOptions = useMemo((): PropertyOption[] => {
        if(!properties) return [];

        const options: PropertyOption[] = [];

        properties.base.forEach((prop) => {
            options.push({
                value: prop,
                title: prop,
                exposureId: null
            });
        });

        Object.entries(properties.modifiers).forEach(([exposureId, props]) => {
            props.forEach((prop) => {
                options.push({
                    value: `${exposureId}:${prop}`,
                    title: `${prop} (${exposureId})`,
                    exposureId
                });
            });
        });

        return options;
    }, [properties]);

    const handlePropertyChange = useCallback((value: string) => {
        setSelectedProperty(value);
        
        const option = propertyOptions.find((opt) => opt.value === value);
        setSelectedExposureId(option?.exposureId ?? null);
    }, [propertyOptions]);

    return {
        property: selectedProperty,
        exposureId: selectedExposureId,
        propertyOptions,
        isLoading,
        handlePropertyChange
    };
};

export default usePropertySelector;
