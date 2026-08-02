import useFrameProperties from './use-frame-properties';
import { buildPropertyOptions, resolvePropertySelection } from './use-property-selector.utils';
import { useState, useMemo, useEffect } from 'react';

import type { PropertyOption } from './use-property-selector.utils';

interface UsePropertySelectorParams {
    trajectoryId?: string;
    analysisId?: string;
    timestep?: number;
}

interface UsePropertySelectorResult {
    property: string;
    propertyValue: string;
    exposureId: string | null;
    propertyType: 'number' | 'string';
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
    const [selectedPropertyValue, setSelectedPropertyValue] = useState<string>('');

    const { properties, isLoading } = useFrameProperties({
        trajectoryId,
        analysisId,
        timestep
    });

    const propertyOptions = useMemo((): PropertyOption[] => {
        return buildPropertyOptions(properties);
    }, [properties]);

    useEffect(() => {
        setSelectedPropertyValue('');
    }, [analysisId]);

    const activePropertyValue = (propertyOptions.find((option) => option.value === selectedPropertyValue)
        ?? findDefaultPropertyOption(propertyOptions))?.value ?? '';
    const selection = resolvePropertySelection(propertyOptions, activePropertyValue);

    return {
        property: selection.property,
        propertyValue: activePropertyValue,
        exposureId: selection.exposureId,
        propertyType: selection.type,
        propertyOptions,
        isLoading,
        handlePropertyChange: setSelectedPropertyValue
    };
}
