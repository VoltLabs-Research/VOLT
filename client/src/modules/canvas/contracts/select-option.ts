import type { FieldRendererProps } from '@/shared/contracts/form-field';

/**
 * TEMPORARY HOME — see the migration spec §3d.
 *
 * `SelectOption` was a bravais export and the spec is explicit that it was *not*
 * relocated, because it belongs with the app's new Select wrapper, which does not
 * exist yet. The plugin module made the same call in
 * `@/modules/plugin/contracts/select-option`; this file is the canvas module's
 * equivalent so the two do not have to import across module boundaries. Lift both
 * into the shared wrapper when it lands.
 *
 * DERIVED rather than re-declared, for the same reason plugin's is:
 * `@/shared/contracts/form-field` already types `FormFieldRHF`'s `options` prop and
 * every option list here is ultimately handed to that component, so naming its
 * element type is self-correcting — when that file stops importing the type from
 * bravais this alias follows with no edit.
 */
export type SelectOption = FieldRendererProps['options'][number];
