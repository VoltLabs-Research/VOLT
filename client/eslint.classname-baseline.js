
/*
 * Files exempt from the className token ratchet in eslint.config.js.
 * This list only shrinks. New files must use the closed scales defined in
 * src/shared/ui/assets/stylesheets/index.css (see the @theme contract).
 *
 * Why each entry is here:
 *   - WindowControls: macOS traffic-light mimicry (hex dots, 9px glyphs) is
 *     intentionally off-scale.
 *   - AIMessageItem: markdown prose scales type in em relative to the
 *     container, which the fixed scale cannot express.
 */
export const classNameBaseline = [
    'src/shared/ui/components/WindowControls/index.tsx',
    'src/modules/ai/components/AIConversationThread/AIMessageItem.tsx'
];
