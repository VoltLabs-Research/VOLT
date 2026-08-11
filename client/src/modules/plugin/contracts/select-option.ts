import type { FieldRendererProps } from '@/shared/contracts/form-field';

export type SelectOption = FieldRendererProps['options'][number];

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
