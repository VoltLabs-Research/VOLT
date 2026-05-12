import type { FilterPropertiesData } from '../../api/services/particle-filter-service';

export interface PropertyOption {
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

const buildOptionTitle = (property: string): string => property;

export const buildPropertyOptions = (properties: FilterPropertiesData | undefined): PropertyOption[] => {
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
                title: buildOptionTitle(property),
                property,
                exposureId,
                type
            });
        });
    });

    return options;
};

export const resolvePropertySelection = (
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
