import type { FilterPropertiesData } from '../../api/dtos/particle-filter';

export interface PropertyOption {
    value: string;
    title: string;
    property: string;
    exposureId: string | null;
};

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
            exposureId: null
        });
    });

    Object.entries(properties.perAtom).forEach(([exposureId, perAtomProperties]) => {
        perAtomProperties.forEach((property) => {
            options.push({
                value: buildModifierPropertyValue(exposureId, property),
                title: buildOptionTitle(property),
                property,
                exposureId
            });
        });
    });

    return options;
};

export const resolvePropertySelection = (
    propertyOptions: PropertyOption[],
    value: string
): { property: string; exposureId: string | null } => {
    const option = propertyOptions.find((candidate) => candidate.value === value);

    return {
        property: option?.property ?? '',
        exposureId: option?.exposureId ?? null
    };
};
