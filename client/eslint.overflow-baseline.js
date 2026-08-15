/*
 * Files exempt from the scroll-affordance ratchet in eslint.config.js.
 * This list only shrinks. Everywhere else, a scrolling region is
 * src/shared/ui/components/Scrollable, so it carries an edge fade — scrollbars are hidden
 * globally (index.css) and the fade is the only cue that content continues.
 *
 * Why each entry is here:
 *   - Prose: `[&_pre]:overflow-x-auto` styles the <pre> elements markdown produces. There is no
 *     element to wrap, because the component never renders them itself.
 *   - DocumentListingTable: nested x and y scrollers around a sticky header, two density
 *     variants and role='grid'. Wrapping it would not be a conversion but a rewrite; it needs
 *     its own change.
 *   - AIArtifactSpreadsheetPanel: scrolls on both axes at once, which one mask cannot express
 *     (the fade is per-orientation), and its header is a real <th> inside a <table> that cannot
 *     be hoisted out of the scroller without rebuilding the table.
 *   - TimelineRuler: a scrubbing ruler. The fade would dissolve the tick marks at both ends,
 *     which are the reference the user is aiming at.
 *   - Timeline, TimelineTabContent: `max-md:overflow-auto` — these scroll only below 768px and
 *     are overflow-hidden above it. Scrollable is unconditionally a scroller, so it cannot
 *     express a breakpoint-scoped one.
 */
export const overflowBaseline = [
    'src/shared/ui/components/Prose/index.tsx',
    // DocumentListingGrid temporarily reverted: Scrollable + dnd-kit caused click-swallowing
    'src/shared/ui/components/DocumentListingGrid/index.tsx',
    'src/shared/ui/components/DocumentListingTable/index.tsx',
    'src/modules/ai/components/AIArtifactSpreadsheetPanel/index.tsx',
    'src/modules/canvas/components/TimelineRuler/index.tsx',
    'src/modules/canvas/components/Timeline/index.tsx',
    'src/modules/canvas/components/Timeline/TimelineTabContent.tsx'
];
