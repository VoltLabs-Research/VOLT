import useFrameProperties from './use-frame-properties';
import { useState, useMemo, useEffect } from 'react';
import type { FilterPropertiesData } from '../../api/services/particle-filter-service';

interface PropertyOption {
    value: string;
    title: string;
    property: string;
    exposureId: string | null;
    type: 'number' | 'string';
}

const buildDumpPropertyValue = (property: string): string => `dump:${property}`;

const buildModifierPropertyValue = (exposureId: string, property: string): string => {
    return `plugin:${exposureId}:${property}`;
};

const buildPropertyOptions = (properties: FilterPropertiesData | undefined): PropertyOption[] => {
    if (!properties) {
        return [];
    }

    const options: PropertyOption[] = [];

    properties.dump.forEach((property) => {
        options.push({
            value: buildDumpPropertyValue(property),
            title: property,
            property,
            exposureId: null,
            type: 'number'
        });
    });

    Object.entries(properties.perAtom).forEach(([exposureId, perAtomProperties]) => {
        perAtomProperties.forEach((property) => {
            const type = properties.perAtomTypes?.[exposureId]?.[property] ?? 'number';
            options.push({
                value: buildModifierPropertyValue(exposureId, property),
                title: property,
                property,
                exposureId,
                type
            });
        });
    });

    return options;
};

const resolvePropertySelection = (
    propertyOptions: PropertyOption[],
    value: string
): { property: string; exposureId: string | null; type: 'number' | 'string' } => {
    const option = propertyOptions.find((candidate) => candidate.value === value);

    return {
        property: option?.property ?? '',
        exposureId: option?.exposureId ?? null,
        type: option?.type ?? 'number'
    };
};


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
