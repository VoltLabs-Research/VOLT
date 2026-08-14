/*
 * Shared chart chrome, so every recharts surface in the app reads at the same size.
 *
 * These are inline SVG styles rather than class names because recharts renders its axes, ticks and
 * legends as SVG and takes typography through props. That puts them outside the className token
 * ratchet in eslint.config.js, which is exactly why they need a single home: without one they
 * drifted to 9px, 10px, 11px and 12px across seven components, and the 9px and 10px values sat
 * below the app's type floor with nothing to catch them.
 *
 * 12px is `text-xs` on the type scale (the label role). 11px (`text-2xs`) is the floor — nothing in
 * a chart may go below it, and there is no constant here for anything smaller on purpose.
 */

/** Axis ticks, axis labels and legends. */
export const CHART_FONT_SIZE = '12px';

/** Grid lines, axis lines and any other structural stroke. */
export const CHART_GRID_COLOR = 'var(--border)';

/** Tick and axis label text. */
export const CHART_AXIS_COLOR = 'var(--muted)';

/** Ready-made `tick` prop for a recharts axis: `<XAxis tick={CHART_TICK} />`. */
export const CHART_TICK = {
    fill: CHART_AXIS_COLOR,
    fontSize: CHART_FONT_SIZE
};
