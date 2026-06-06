import type { SelectOption } from './index';

/**
 * Shared trigger-label resolver for multi-selects: shows an empty placeholder
 * with no selection, the option title for a single selection, and a count with
 * a contextual suffix otherwise.
 */
export const getMultiSelectTriggerLabel = (
    selectedCount: number,
    selectedValues: string[] | undefined,
    options: SelectOption[],
    emptyLabel: string,
    selectedSuffix: string
): string => {
    if (selectedCount === 0) {
        return emptyLabel;
    }

    if (selectedCount === 1) {
        const selectedValue = selectedValues?.[0];
        return options.find((option) => option.value === selectedValue)?.title ?? '1 selected';
    }

    return `${selectedCount} ${selectedSuffix}`;
};
