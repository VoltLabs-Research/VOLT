import { cn } from '@heroui/react';
import { SELECT_ROOT_CLASS, resolveFieldSurfaceClasses } from '@/shared/ui/components/FormFieldRHF/field-styles';

/**
 * The canvas field surface, for the two selects in this module that are NOT rendered
 * by `FormFieldRHF`.
 *
 * `ArgumentFieldsRenderer` and `PluginConfigField` hand-write a field row —
 * `.form-field-canvas` > `.canvas-form-label` + `.render-input-container` — around a
 * multi-select, because `FormFieldRHF` has no multi-select mode. Those class names
 * came from `FormField.css`, which `shared/ui` deleted, so the row is unstyled unless
 * this module supplies the same utilities the shared renderer now emits.
 *
 * It reuses `field-styles.ts` rather than restating the values: the whole point of
 * that module is that the three field surfaces are declared once, and a hand-written
 * canvas row that drifted from `FormFieldRHF`'s would be visible — these fields sit
 * directly above and below ones the shared component renders.
 *
 * ── the legacy class names stay ───────────────────────────────────────────────
 *
 * `.form-field-canvas`, `.canvas-form-label`, `.render-input-container`,
 * `.form-field-canvas-select` and `.labeled-input` are kept on the elements *as well
 * as* the utilities, and that is deliberate rather than leftover. They are a
 * cross-module contract: `modules/canvas/components/RightPanel/RightPanel.css` selects
 * all five under `.canvas-plugin-config-view` to restack the row vertically on a
 * narrow right panel, and this module's fields are exactly what renders there.
 * `shared/ui`'s already-migrated `InlineCanvasFieldRenderer` keeps them for the same
 * reason. They come out when the canvas module's sheet does.
 */
export const CANVAS_FIELD = {
    ...resolveFieldSurfaceClasses('canvas', 'select', true),
    selectRoot: SELECT_ROOT_CLASS
};

/** `.form-field-canvas` — the label/control row. */
export const CANVAS_FIELD_CLASS = cn('form-field-canvas', CANVAS_FIELD.container);

/** `.canvas-form-label` */
export const CANVAS_LABEL_CLASS = cn('canvas-form-label', CANVAS_FIELD.label);

/** `.render-input-container` */
export const CANVAS_SELECT_SLOT_CLASS = cn('render-input-container', CANVAS_FIELD.controlSlot);
