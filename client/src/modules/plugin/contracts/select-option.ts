import type { FieldRendererProps } from '@/shared/contracts/form-field';

/**
 * TEMPORARY HOME — see the migration spec §3d.
 *
 * `SelectOption` and `getMultiSelectTriggerLabel` were bravais exports, and the
 * spec is explicit that neither was relocated because both belong with the app's
 * new Select wrapper, which does not exist yet. bravais Select has call sites in
 * eight modules (ai, canvas, cluster, plugin, team, trajectory, …), so the wrapper
 * is genuinely app-level work and not this module's to invent in `shared/ui`.
 *
 * Until it lands, this file is the plugin module's local home for both. Lift it
 * verbatim into the shared wrapper and repoint the imports — nothing here is
 * plugin-specific.
 *
 * `SelectOption` is DERIVED rather than re-declared on purpose.
 * `@/shared/contracts/form-field` already types `FormFieldRHF`'s `options` prop,
 * and every option list in this module is ultimately handed to that component, so
 * naming its element type is both exactly right today and self-correcting: when
 * that file stops importing the type from bravais, this alias follows with no edit,
 * and if the shape is restructured instead, this breaks at compile time rather than
 * drifting into a second, subtly different `{ value, title, description? }`.
 */
export type SelectOption = FieldRendererProps['options'][number];

/**
 * The label a multi-select trigger shows for the current selection.
 *
 * Copied byte-for-byte from bravais 1.0.5 (`getMultiSelectTriggerLabel`),
 * including the `'1 selected'` fallback for a selected value that is no longer in
 * `options` — a plugin filter keeps a key whose plugin was unpublished, and that
 * fallback is what stops the trigger going blank.
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
