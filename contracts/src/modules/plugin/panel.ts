import type { IPanelColumn, PanelColumnFormat } from './exposure';

export type PanelRgba = [number, number, number, number];

export type PanelScalar = string | number | boolean | null;

export type PanelNumber = number | { source: string };

interface PanelBlockBase{
    title: string;
}

export interface PanelTableBlock extends PanelBlockBase{
    kind: 'table';
    source: string;
    label: string;
    columns: IPanelColumn[];
    colorBy?: string;
    colors?: Record<string, PanelRgba>;
}

export interface PanelCategoricalAxis{
    kind: 'categories';
    source: string;
}

export interface PanelIntervalAxis{
    kind: 'interval';
    start: PanelNumber;
    end: PanelNumber;
}

export type PanelChartAxis = PanelCategoricalAxis | PanelIntervalAxis;

export interface PanelChartMarker{
    value: PanelNumber;
    label?: string;
    style?: 'line' | 'zone';
}

export interface PanelChartBlock extends PanelBlockBase{
    kind: 'chart';
    chartType: 'bar' | 'line';
    values: string;
    x: PanelChartAxis;
    xAxisLabel?: string;
    yAxisLabel?: string;
    valueFormat?: PanelColumnFormat;
    markers?: PanelChartMarker[];
}

export interface PanelStatBlock extends PanelBlockBase{
    kind: 'stat';
    source: string;
    format?: PanelColumnFormat;
    unit?: string;
}

export type PanelBlock = PanelTableBlock | PanelChartBlock | PanelStatBlock;

export interface IPanelExportOptions{
    blocks: PanelBlock[];
    title?: string;
}

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
    truncated?: PanelTruncation;
}

export interface ResolvedPanelChartBlock{
    kind: 'chart';
    title: string;
    chartType: 'bar' | 'line';
    values: number[];
    categories?: string[];
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
    unreadable?: { exposureId: string; reason: string }[];
}

export const PANEL_DOCUMENT_VERSION = 1;
