import { resolvePanelBlocks } from '@modules/plugin/services/exports/panel-exporter';
import { buildObjectPath } from '@modules/plugin/services/exports/export-node-processor-shared';
import type {
    PanelBlockDeclaration,
    PanelExportOptions
} from '@modules/plugin/services/exports/export-node-processor-types';
import type { JsonObject } from '@shared/contracts/types/json';

interface CheckResult {
    label: string;
    passed: boolean;
    detail: string;
}

const results: CheckResult[] = [];

const check = (label: string, passed: boolean, detail: string): void => {
    results.push({
        label,
        passed,
        detail
    });
};

const options = (blocks: PanelBlockDeclaration[]): PanelExportOptions => ({ blocks });

const ptmPayload: JsonObject = {
    structure_counts: {
        rows: [
            {
                structure_id: 0,
                structure_name: 'OTHER',
                count: 36714,
                fraction: 0.16611091253772267
            },
            {
                structure_id: 1,
                structure_name: 'SC',
                count: 184307,
                fraction: 0.8338890874622773
            }
        ]
    },
    rmsd_histogram: {
        count: Array.from({ length: 100 }, (_, index) => 100 - index),
        interval_start: 0,
        interval_end: 0.1414,
        cutoff: 0.1
    }
};

const TABLE_BLOCK: PanelBlockDeclaration = {
    kind: 'table',
    title: 'Structure analysis results',
    source: 'structure_counts.rows',
    label: 'structure_name',
    colorBy: 'structure_name',
    columns: [
        {
            column: 'count',
            label: 'Count',
            format: 'integer'
        },
        {
            column: 'fraction',
            label: 'Fraction',
            format: 'percent'
        }
    ]
};

const INTERVAL_CHART_BLOCK: PanelBlockDeclaration = {
    kind: 'chart',
    title: 'RMSD distribution',
    chartType: 'line',
    values: 'rmsd_histogram.count',
    x: {
        kind: 'interval',
        start: 0,
        end: { source: 'rmsd_histogram.interval_end' }
    },
    xAxisLabel: 'RMSD',
    markers: [{
        value: { source: 'rmsd_histogram.cutoff' },
        label: 'RMSD cutoff',
        style: 'zone'
    }]
};

{
    const blocks = resolvePanelBlocks(ptmPayload, options([TABLE_BLOCK, INTERVAL_CHART_BLOCK]));
    const table = blocks.find((block) => block.kind === 'table');
    const chart = blocks.find((block) => block.kind === 'chart');

    check(
        'table resolves with the declared label and columns',
        table?.kind === 'table'
            && table.rows.length === 2
            && table.rows[0].structure_name === 'OTHER'
            && table.rows[1].count === 184307
            && table.truncated === undefined,
        table?.kind === 'table' ? `${table.rows.length} rows` : `got ${table?.kind ?? 'nothing'}`
    );

    check(
        'binned chart resolves values, a dotted interval end and a dotted marker',
        chart?.kind === 'chart'
            && chart.values.length === 100
            && chart.interval?.start === 0
            && chart.interval?.end === 0.1414
            && chart.categories === undefined
            && chart.markers?.[0].value === 0.1
            && chart.markers?.[0].style === 'zone',
        chart?.kind === 'chart'
            ? `${chart.values.length} points, interval ${JSON.stringify(chart.interval)}, marker ${String(chart.markers?.[0].value)}`
            : `got ${chart?.kind ?? 'nothing'}`
    );
}

{
    const payload: JsonObject = {
        ordering: {
            names: ['FCC', 'HCP', 'BCC'],
            counts: [10, 20, 30]
        }
    };
    const blocks = resolvePanelBlocks(payload, options([{
        kind: 'chart',
        title: 'Chemical ordering',
        chartType: 'bar',
        values: 'ordering.counts',
        x: {
            kind: 'categories',
            source: 'ordering.names'
        }
    }]));
    const chart = blocks[0];

    check(
        'categorical chart carries labels parallel to its values',
        chart?.kind === 'chart' && chart.categories?.length === 3 && chart.values.length === 3 && chart.interval === undefined,
        chart?.kind === 'chart' ? `categories ${JSON.stringify(chart.categories)}` : `got ${chart?.kind ?? 'nothing'}`
    );
}

{
    const absent = resolvePanelBlocks({}, options([TABLE_BLOCK, INTERVAL_CHART_BLOCK]));
    check(
        'an absent source produces no block at all',
        absent.length === 0,
        `${absent.length} blocks`
    );

    const wrongShape = resolvePanelBlocks({ structure_counts: { rows: 'not-an-array' } }, options([TABLE_BLOCK]));
    check(
        'a present but wrong-shaped source produces an omitted block with a reason',
        wrongShape.length === 1
            && wrongShape[0].kind === 'omitted'
            && wrongShape[0].reason.includes('not an array'),
        wrongShape[0]?.kind === 'omitted' ? wrongShape[0].reason : `got ${wrongShape[0]?.kind ?? 'nothing'}`
    );
}

{
    const rows = Array.from({ length: 600 }, (_, index) => ({
        structure_name: `S${index}`,
        count: index,
        fraction: 0
    }));
    const blocks = resolvePanelBlocks({ structure_counts: { rows } }, options([TABLE_BLOCK]));
    const table = blocks[0];

    check(
        'an over-cap table is truncated and says so',
        table?.kind === 'table'
            && table.rows.length === 512
            && table.truncated?.shown === 512
            && table.truncated?.total === 600,
        table?.kind === 'table' ? `${table.rows.length} of ${String(table.truncated?.total)}` : `got ${table?.kind ?? 'nothing'}`
    );
}

{
    const payload: JsonObject = {
        rmsd_histogram: {
            count: Array.from({ length: 5000 }, () => 1),
            interval_end: 1
        }
    };
    const blocks = resolvePanelBlocks(payload, options([INTERVAL_CHART_BLOCK]));
    const chart = blocks[0];

    check(
        'an over-cap chart is refused rather than clipped',
        chart?.kind === 'omitted' && chart.reason.includes('5000'),
        chart?.kind === 'omitted' ? chart.reason : `got ${chart?.kind ?? 'nothing'}`
    );
}

{
    const payload: JsonObject = {
        ordering: {
            names: ['FCC', 'HCP'],
            counts: [1, 2, 3]
        }
    };
    const blocks = resolvePanelBlocks(payload, options([{
        kind: 'chart',
        title: 'Chemical ordering',
        chartType: 'bar',
        values: 'ordering.counts',
        x: {
            kind: 'categories',
            source: 'ordering.names'
        }
    }]));
    const chart = blocks[0];

    check(
        'categories that do not match the values are refused',
        chart?.kind === 'omitted' && chart.reason.includes('different lengths'),
        chart?.kind === 'omitted' ? chart.reason : `got ${chart?.kind ?? 'nothing'}`
    );
}

{
    const blocks = resolvePanelBlocks(
        { totals: { atoms: 221021 } },
        options([
            {
                kind: 'stat',
                title: 'Atoms',
                source: 'totals.atoms',
                format: 'integer'
            },
            {
                kind: 'histogram-3d',
                title: 'From the future'
            } as unknown as PanelBlockDeclaration
        ])
    );

    check(
        'a stat resolves to a scalar',
        blocks[0]?.kind === 'stat' && blocks[0].value === 221021,
        blocks[0]?.kind === 'stat' ? String(blocks[0].value) : `got ${blocks[0]?.kind ?? 'nothing'}`
    );

    check(
        'an unknown block kind is omitted, not crashed on',
        blocks[1]?.kind === 'omitted' && blocks[1].reason.includes('histogram-3d'),
        blocks[1]?.kind === 'omitted' ? blocks[1].reason : `got ${blocks[1]?.kind ?? 'nothing'}`
    );
}

{
    const input = {
        executionData: {
            trajectoryId: 'traj1',
            analysisId: 'an1'
        },
        timestep: 1275000,
        exposure: { nodeId: 'ptm-analysis-exposure' }
    } as Parameters<typeof buildObjectPath>[0];

    const panelPath = buildObjectPath(input, 'PanelExporter', 'panel-json');
    check(
        'a panel is keyed under panels/ with a .json extension',
        panelPath === 'trajectory-traj1/analysis-an1/panels/1275000/ptm-analysis-exposure.json',
        panelPath
    );

    const glbPath = buildObjectPath(input, 'AtomisticExporter', 'glb');
    check(
        'the glb path is unchanged by the new branch',
        glbPath === 'trajectory-traj1/analysis-an1/glb/1275000/ptm-analysis-exposure.glb',
        glbPath
    );
}

const failed = results.filter((result) => !result.passed);

for (const result of results) {
    console.log(`${result.passed ? 'PASS' : 'FAIL'}  ${result.label}\n      ${result.detail}`);
}

console.log(`\n${results.length - failed.length}/${results.length} checks passed`);

if (failed.length > 0) {
    process.exitCode = 1;
}
