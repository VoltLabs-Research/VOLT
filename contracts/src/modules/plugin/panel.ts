import type { IPanelColumn, PanelColumnFormat } from './exposure';

/*
 * What a plugin declares for the canvas right sidebar, and what the daemon resolves it
 * into.
 *
 * This is the successor to `exposure.panel` (see ./exposure.ts), which could only
 * express tables. A plugin declares these blocks on an **export node** — exporter
 * `PanelExporter` — so sidebar content is declared the same way every other output is,
 * and the exporter resolves each block against the exposure payload while it still has
 * it in hand.
 *
 * The target is the block OVITO puts beside a modifier: for PTM, a structure table with
 * counts and fractions plus the RMSD distribution with its cutoff shaded. VOLT holds no
 * knowledge of what any of it means — the plugin names the sources, the columns, the
 * categories and their colours.
 */

export type PanelRgba = [number, number, number, number];

/** What can land in a resolved cell. Anything else is refused at resolve time. */
export type PanelScalar = string | number | boolean | null;

/**
 * A number the plugin cannot know when it writes its manifest, so it may point at the
 * payload instead of stating a value.
 *
 * PTM needs both forms: its histogram range is `1.01 * max(rmsd)`, recomputed every
 * frame, while a threshold the user typed is a plain argument. A literal-only field
 * would make the first case inexpressible.
 */
export type PanelNumber = number | { source: string };

interface PanelBlockBase{
    title: string;
}

export interface PanelTableBlock extends PanelBlockBase{
    kind: 'table';
    /** Dotted path to an array of row objects, resolved against the exposure payload. */
    source: string;
    /** Row label column. */
    label: string;
    columns: IPanelColumn[];
    /**
     * Column whose value keys into `colors`, painting the swatch that ties a row to the
     * geometry it counts. Omit for a table with no colour dimension.
     */
    colorBy?: string;
    /**
     * Category -> RGBA (0-1), declared by the plugin. A category with no declared colour
     * gets no swatch: an invented one would disagree with the colour the same category
     * carries in the viewport, which is worse than an absent one.
     */
    colors?: Record<string, PanelRgba>;
}

/** x is a column of labels, one per value. OVITO's `DataTable::BarChart`. */
export interface PanelCategoricalAxis{
    kind: 'categories';
    /** Dotted path to an array of labels, parallel to the values. */
    source: string;
}

/**
 * x is implicit: the values are counts in n uniform bins spanning [start, end].
 *
 * This mirrors OVITO's `setIntervalStart` / `setIntervalEnd`, where a histogram carries
 * a y buffer and no x property at all — the reason a histogram is not row-shaped and
 * cannot travel as a sub-listing.
 */
export interface PanelIntervalAxis{
    kind: 'interval';
    start: PanelNumber;
    end: PanelNumber;
}

/*
 * A discriminated union rather than two optional fields: with `categories?` beside
 * `interval?` a manifest could declare both, or neither, and the renderer would be left
 * guessing which one the plugin meant.
 */
export type PanelChartAxis = PanelCategoricalAxis | PanelIntervalAxis;

export interface PanelChartMarker{
    value: PanelNumber;
    label?: string;
    /** `line` draws a rule at the value; `zone` shades up to it, as OVITO shades a cutoff. */
    style?: 'line' | 'zone';
}

export interface PanelChartBlock extends PanelBlockBase{
    kind: 'chart';
    chartType: 'bar' | 'line';
    /** Dotted path to a numeric array: the values plotted. */
    values: string;
    x: PanelChartAxis;
    /**
     * Rendered as a caption beside the title, not as text inside the plot. The sidebar's
     * type scale bottoms out at 11px, and axis titles are the first thing that cannot fit
     * a 240px column at that size.
     */
    xAxisLabel?: string;
    yAxisLabel?: string;
    valueFormat?: PanelColumnFormat;
    markers?: PanelChartMarker[];
}

export interface PanelStatBlock extends PanelBlockBase{
    kind: 'stat';
    /** Dotted path to a scalar. */
    source: string;
    format?: PanelColumnFormat;
    unit?: string;
}

export type PanelBlock = PanelTableBlock | PanelChartBlock | PanelStatBlock;

/** The `options` of an export node whose exporter is `PanelExporter`. */
export interface IPanelExportOptions{
    blocks: PanelBlock[];
    /** Section sub-heading. Defaults to the exposure's name. */
    title?: string;
}

/* ------------------------------------------------------------------ *
 * The resolved document: what the exporter writes and the client reads.
 * ------------------------------------------------------------------ */

export interface PanelTruncation{
    shown: number;
    total: number;
}

export interface ResolvedPanelTableBlock{
    kind: 'table';
    title: string;
    label: string;
    columns: IPanelColumn[];
    colorBy?: string;
    colors?: Record<string, PanelRgba>;
    rows: Record<string, PanelScalar>[];
    /** Set when rows were capped, so the client can say so instead of just clipping. */
    truncated?: PanelTruncation;
}

export interface ResolvedPanelChartBlock{
    kind: 'chart';
    title: string;
    chartType: 'bar' | 'line';
    values: number[];
    /** Present for a categorical axis; parallel to `values`. */
    categories?: string[];
    /** Present for a binned axis. */
    interval?: { start: number; end: number };
    xAxisLabel?: string;
    yAxisLabel?: string;
    valueFormat?: PanelColumnFormat;
    markers?: { value: number; label?: string; style: 'line' | 'zone' }[];
}

export interface ResolvedPanelStatBlock{
    kind: 'stat';
    title: string;
    value: PanelScalar;
    format?: PanelColumnFormat;
    unit?: string;
}

/**
 * A block the plugin declared and the exporter refused to resolve — wrong shape, or past
 * a cap. It travels into the document instead of vanishing, because a summary that
 * quietly loses a block is harder to debug than one that states why.
 *
 * An **absent** source is not a refusal: declaring a block and emitting its data only
 * under some argument is the intended way to make a block conditional, and produces no
 * block at all.
 */
export interface OmittedPanelBlock{
    kind: 'omitted';
    title: string;
    reason: string;
}

export type ResolvedPanelBlock =
    | ResolvedPanelTableBlock
    | ResolvedPanelChartBlock
    | ResolvedPanelStatBlock
    | OmittedPanelBlock;

export interface PanelDocument{
    /** Bumped when the resolved shape changes. A reader rejects a version it predates. */
    version: 1;
    exposureId: string;
    exposureName: string;
    timestep: number;
    title?: string;
    blocks: ResolvedPanelBlock[];
}

export interface GetPluginExposurePanelsResponse{
    analysisId: string;
    timestep: number;
    panels: PanelDocument[];
    /**
     * Artifacts that exist but could not be read or parsed. Reported rather than dropped
     * so the sidebar can show a reason where a panel was expected.
     */
    unreadable?: { exposureId: string; reason: string }[];
}

export const PANEL_DOCUMENT_VERSION = 1;
