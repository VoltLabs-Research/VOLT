import { logger } from '@shared/infrastructure/logger';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import { getNestedValue, stageExportBufferUpload } from '@modules/plugin/services/exports/export-node-processor-shared';

import type {
    ExportExecutionInput,
    PanelBlockDeclaration,
    PanelChartBlockDeclaration,
    PanelExportOptions,
    PanelNumber,
    PanelScalar,
    PanelStatBlockDeclaration,
    PanelTableBlockDeclaration
} from '@modules/plugin/services/exports/export-node-processor-types';
import type { JsonObject, JsonValue } from '@shared/contracts/types/json';

const PANEL_MAX_TABLE_ROWS = 512;
const PANEL_MAX_CHART_POINTS = 2048;
const PANEL_MAX_DOCUMENT_BYTES = 1024 * 1024;

const PANEL_DOCUMENT_VERSION = 1;

interface PanelTruncation {
    shown: number;
    total: number;
}

interface ResolvedTableBlock {
    kind: 'table';
    title: string;
    label: string;
    columns: PanelTableBlockDeclaration['columns'];
    colorBy?: string;
    colors?: PanelTableBlockDeclaration['colors'];
    rows: Record<string, PanelScalar>[];
    truncated?: PanelTruncation;
}

interface ResolvedChartBlock {
    kind: 'chart';
    title: string;
    chartType: 'bar' | 'line';
    values: number[];
    categories?: string[];
    interval?: { start: number; end: number };
    xAxisLabel?: string;
    yAxisLabel?: string;
    valueFormat?: PanelChartBlockDeclaration['valueFormat'];
    markers?: { value: number; label?: string; style: 'line' | 'zone' }[];
}

interface ResolvedStatBlock {
    kind: 'stat';
    title: string;
    value: PanelScalar;
    format?: PanelStatBlockDeclaration['format'];
    unit?: string;
}

interface OmittedBlock {
    kind: 'omitted';
    title: string;
    reason: string;
}

type ResolvedBlock = ResolvedTableBlock | ResolvedChartBlock | ResolvedStatBlock | OmittedBlock;

type BlockOutcome = ResolvedBlock | null;

const omit = (title: string, reason: string): OmittedBlock => ({
    kind: 'omitted',
    title,
    reason
});

const isPresent = (value: JsonValue | undefined): boolean => value !== undefined && value !== null;

const toPanelScalar = (value: JsonValue | undefined): PanelScalar => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;

    return null;
};

const toFiniteNumber = (value: JsonValue | undefined): number | null => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
};

const resolvePanelNumber = (payload: JsonObject, value: PanelNumber): number | null => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value?.source !== 'string') return null;

    return toFiniteNumber(getNestedValue(payload, value.source));
};

const resolveTableBlock = (payload: JsonObject, block: PanelTableBlockDeclaration): BlockOutcome => {
    const source = getNestedValue(payload, block.source);
    if (!isPresent(source)) return null;

    if (!Array.isArray(source)) {
        return omit(block.title, `Source "${block.source}" is not an array of rows`);
    }

    const total = source.length;
    const kept = source.slice(0, PANEL_MAX_TABLE_ROWS);
    const rows = kept
        .filter((row): row is JsonObject => typeof row === 'object' && row !== null && !Array.isArray(row))
        .map((row) => {
            const cells: Record<string, PanelScalar> = { [block.label]: toPanelScalar(row[block.label]) };
            for (const column of block.columns) {
                cells[column.column] = toPanelScalar(row[column.column]);
            }

            return cells;
        });

    if (rows.length === 0) {
        return omit(block.title, `Source "${block.source}" holds no row objects`);
    }

    const truncated: PanelTruncation | undefined = total > rows.length
        ? {
            shown: rows.length,
            total
        }
        : undefined;

    return {
        kind: 'table',
        title: block.title,
        label: block.label,
        columns: block.columns,
        ...(block.colorBy ? { colorBy: block.colorBy } : {}),
        ...(block.colors ? { colors: block.colors } : {}),
        rows,
        ...(truncated ? { truncated } : {})
    };
};

const resolveChartBlock = (payload: JsonObject, block: PanelChartBlockDeclaration): BlockOutcome => {
    const rawValues = getNestedValue(payload, block.values);
    if (!isPresent(rawValues)) return null;

    if (!Array.isArray(rawValues)) {
        return omit(block.title, `Values "${block.values}" is not an array`);
    }

    if (rawValues.length > PANEL_MAX_CHART_POINTS) {
        return omit(block.title, `${rawValues.length} points exceeds the ${PANEL_MAX_CHART_POINTS} point limit`);
    }

    const values: number[] = [];
    for (const entry of rawValues) {
        const parsed = toFiniteNumber(entry);
        if (parsed === null) {
            return omit(block.title, `Values "${block.values}" holds a non-numeric entry`);
        }
        values.push(parsed);
    }

    if (values.length === 0) {
        return omit(block.title, `Values "${block.values}" is empty`);
    }

    const resolved: ResolvedChartBlock = {
        kind: 'chart',
        title: block.title,
        chartType: block.chartType,
        values,
        ...(block.xAxisLabel ? { xAxisLabel: block.xAxisLabel } : {}),
        ...(block.yAxisLabel ? { yAxisLabel: block.yAxisLabel } : {}),
        ...(block.valueFormat ? { valueFormat: block.valueFormat } : {})
    };

    if (block.x.kind === 'categories') {
        const rawCategories = getNestedValue(payload, block.x.source);
        if (!Array.isArray(rawCategories)) {
            return omit(block.title, `Categories "${block.x.source}" is not an array`);
        }
        if (rawCategories.length !== values.length) {
            return omit(
                block.title,
                `Categories (${rawCategories.length}) and values (${values.length}) have different lengths`
            );
        }
        resolved.categories = rawCategories.map((entry) => String(toPanelScalar(entry) ?? ''));
    } else {
        const start = resolvePanelNumber(payload, block.x.start);
        const end = resolvePanelNumber(payload, block.x.end);
        if (start === null || end === null) {
            return omit(block.title, 'Interval start or end did not resolve to a number');
        }
        if (end <= start) {
            return omit(block.title, `Interval end (${end}) is not greater than start (${start})`);
        }
        resolved.interval = {
            start,
            end
        };
    }

    const markers = (block.markers ?? [])
        .map((marker) => {
            const value = resolvePanelNumber(payload, marker.value);
            if (value === null) return null;

            return {
                value,
                ...(marker.label ? { label: marker.label } : {}),
                style: marker.style ?? 'line' as const
            };
        })
        .filter((marker): marker is NonNullable<typeof marker> => marker !== null);

    if (markers.length > 0) {
        resolved.markers = markers;
    }

    return resolved;
};

const resolveStatBlock = (payload: JsonObject, block: PanelStatBlockDeclaration): BlockOutcome => {
    const source = getNestedValue(payload, block.source);
    if (!isPresent(source)) return null;

    const value = toPanelScalar(source);
    if (value === null) {
        return omit(block.title, `Source "${block.source}" is not a scalar`);
    }

    return {
        kind: 'stat',
        title: block.title,
        value,
        ...(block.format ? { format: block.format } : {}),
        ...(block.unit ? { unit: block.unit } : {})
    };
};

const resolveBlock = (payload: JsonObject, block: PanelBlockDeclaration): BlockOutcome => {
    switch (block.kind) {
        case 'table': return resolveTableBlock(payload, block);
        case 'chart': return resolveChartBlock(payload, block);
        case 'stat': return resolveStatBlock(payload, block);
        default: {
            const unknown = block as { kind?: unknown; title?: unknown };
            return omit(
                typeof unknown.title === 'string' ? unknown.title : 'Unknown block',
                `Unsupported block kind "${String(unknown.kind)}"`
            );
        }
    }
};

export const resolvePanelBlocks = (
    payload: JsonObject,
    options: PanelExportOptions
): ResolvedBlock[] => {
    return options.blocks
        .map((block) => resolveBlock(payload, block))
        .filter((block): block is ResolvedBlock => block !== null);
};

export const exportPanelArtifact = async (
    input: ExportExecutionInput,
    exportData: JsonObject,
    objectPath: string,
    ownerClusterId: string,
    options: PanelExportOptions
): Promise<boolean> => {
    const blocks = resolvePanelBlocks(exportData, options);

    const context = {
        analysisId: input.executionData.analysisId,
        exposureId: input.exposure.nodeId,
        timestep: input.timestep
    };

    if (blocks.length === 0) {
        logger.warn(context, 'PanelExporter: no declared block resolved; no panel written');
        return false;
    }

    for (const block of blocks) {
        const blockContext = {
            ...context,
            title: block.title
        };

        if (block.kind === 'omitted') {
            logger.warn(blockContext, `PanelExporter: block omitted — ${block.reason}`);
        }

        if (block.kind === 'table' && block.truncated) {
            logger.warn({
                ...blockContext,
                ...block.truncated
            }, 'PanelExporter: table truncated');
        }
    }

    const document = {
        version: PANEL_DOCUMENT_VERSION,
        exposureId: input.exposure.nodeId,
        exposureName: input.exposure.name,
        timestep: input.timestep,
        ...(options.title ? { title: options.title } : {}),
        blocks
    };

    const buffer = Buffer.from(JSON.stringify(document), 'utf8');

    if (buffer.byteLength > PANEL_MAX_DOCUMENT_BYTES) {
        logger.warn(
            {
 ...context, bytes: buffer.byteLength, limit: PANEL_MAX_DOCUMENT_BYTES 
},
            'PanelExporter: document exceeds the size limit; no panel written'
        );
        return false;
    }

    await stageExportBufferUpload(input, {
        exporter: 'PanelExporter',
        bucket: ObjectBucketName.Plugins,
        buffer,
        contentType: 'application/json',
        objectPath,
        ownerClusterId
    });

    return true;
};
