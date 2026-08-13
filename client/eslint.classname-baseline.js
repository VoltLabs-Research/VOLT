/*
 * Files exempt from the className token ratchet in eslint.config.js.
 * This list only shrinks. New files must use the closed scales defined in
 * src/shared/ui/assets/stylesheets/index.css (see the @theme contract).
 *
 * Why each entry is here:
 *   - WindowControls: macOS traffic-light mimicry (hex dots, 9px glyphs) is
 *     intentionally off-scale.
 *
 * Removed:
 *   - AIMessageItem, which was exempt because its markdown sized type in `em`
 *     relative to the container. That markup moved to shared/ui/components/Prose
 *     and now uses the type scale, so neither file needs the exemption.
 */
export const classNameBaseline = [
    'src/shared/ui/components/WindowControls/index.tsx'
];
