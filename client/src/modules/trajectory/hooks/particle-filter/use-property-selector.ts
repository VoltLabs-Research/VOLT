import useFrameProperties from './use-frame-properties';
import { buildPropertyOptions, resolvePropertySelection } from './use-property-selector.utilities';
import { useState, useCallback, useMemo, useEffect } from 'react';

import type { PropertyOption } from './use-property-selector.utilities';


interface UsePropertySelectorParams {
    trajectoryId?: string;
    analysisId?: string;
    timestep?: number;
}

interface UsePropertySelectorResult {
    property: string;
    propertyValue: string;
    exposureId: string | null;
    propertyOptions: PropertyOption[];
    isLoading: boolean;
    handlePropertyChange: (value: string) => void;
}

const findDefaultPropertyOption = (propertyOptions: PropertyOption[]): PropertyOption | undefined => {
    const typeOption = propertyOptions.find((option) => option.exposureId === null && option.property.toLowerCase() === 'type');
    if (typeOption) {
        return typeOption;
    }

    return propertyOptions[0];
};

export default function usePropertySelector(params: UsePropertySelectorParams): UsePropertySelectorResult {
    const { trajectoryId, analysisId, timestep } = params;
    const [selectedProperty, setSelectedProperty] = useState<string>('');
    const [selectedPropertyValue, setSelectedPropertyValue] = useState<string>('');
    const [selectedExposureId, setSelectedExposureId] = useState<string | null>(null);

    const { properties, isLoading } = useFrameProperties({
        trajectoryId,
        analysisId,
        timestep
    });

    const propertyOptions = useMemo((): PropertyOption[] => {
        return buildPropertyOptions(properties);
    }, [properties]);

    useEffect(() => {
        setSelectedProperty('');
        setSelectedPropertyValue('');
        setSelectedExposureId(null);
    }, [analysisId]);

    useEffect(() => {
        const selectedOption = propertyOptions.find((option) => option.value === selectedPropertyValue);
        if (selectedOption) {
            if (selectedProperty !== selectedOption.property) {
                setSelectedProperty(selectedOption.property);
            }
            if (selectedExposureId !== selectedOption.exposureId) {
                setSelectedExposureId(selectedOption.exposureId);
            }
            return;
        }

        const defaultOption = findDefaultPropertyOption(propertyOptions);
        if (!defaultOption) {
            if (selectedProperty !== '') {
                setSelectedProperty('');
            }
            if (selectedPropertyValue !== '') {
                setSelectedPropertyValue('');
            }
            if (selectedExposureId !== null) {
                setSelectedExposureId(null);
            }
            return;
        }

        setSelectedProperty(defaultOption.property);
        setSelectedPropertyValue(defaultOption.value);
        setSelectedExposureId(defaultOption.exposureId);
    }, [propertyOptions, selectedExposureId, selectedProperty, selectedPropertyValue]);

    const handlePropertyChange = useCallback((value: string) => {
        const selection = resolvePropertySelection(propertyOptions, value);
        setSelectedProperty(selection.property);
        setSelectedPropertyValue(value);
        setSelectedExposureId(selection.exposureId);
    }, [propertyOptions]);

    return {
        property: selectedProperty,
        propertyValue: selectedPropertyValue,
        exposureId: selectedExposureId,
        propertyOptions,
        isLoading,
        handlePropertyChange
    };
}
