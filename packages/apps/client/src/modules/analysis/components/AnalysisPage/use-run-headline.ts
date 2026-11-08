import { useRunLatestRows } from '@/modules/analysis/hooks/use-run-listing-rows';
import { buildRunSeries, listPanelTables, seriesValues } from '@/modules/analysis/utils/run-results';
import { toCompositionParts } from '@/modules/analysis/utils/panel-composition';
import { useSubListingInfiniteQuery } from '@/modules/plugin/hooks/listing/queries';
import { AnalysisStatus } from '@/modules/fractal/contracts';
import { useMemo } from 'react';
import type { CompositionPart } from '@/modules/analysis/components/charts/CompositionBar';
import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';

export type RunHeadline =
    | { kind: 'composition'; parts: CompositionPart[]; lead: CompositionPart }
    | { kind: 'metric'; values: (number | null)[]; value: number | null; label: string }
    | { kind: 'none' };

/*
 * The value a list row shows. Plugins do not declare a headline yet: a run whose plugin declares a panel
 * shows the first panel table's composition at its last timestep; any other run shows its listing's first
 * changing column. The rows come from the run's newest listing page.
 */
const useRunHeadline = (analysis: Analysis, plugin: Plugin | undefined, isVisible: boolean): RunHeadline => {
    const isCompleted = analysis.status === AnalysisStatus.Completed;
    const rowsQuery = useRunLatestRows(analysis._id, isVisible && isCompleted);
    const rows = rowsQuery.data?.data;
    const panel = useMemo(() => listPanelTables(plugin)[0], [plugin]);

    const latestTimestep = useMemo(() => {
        if (!rows?.length) return undefined;
        const panelRows = panel ? rows.filter((row) => row.exposureId === panel.exposureId) : [];
        return Math.max(...(panelRows.length ? panelRows : rows).map((row) => row.timestep));
    }, [rows, panel]);

    const panelQuery = useSubListingInfiniteQuery(
        {
            analysisId: analysis._id,
            exposureId: panel?.exposureId ?? '',
            timestep: latestTimestep ?? 0,
            subListingName: panel?.table.source ?? '',
            limit: 64
        },
        {
            getNextPageParam: () => undefined,
            enabled: Boolean(panel && latestTimestep !== undefined)
        }
    );

    return useMemo<RunHeadline>(() => {
        const panelRows = panelQuery.data?.pages.flatMap((page) => page.rows) ?? [];
        if (panel && panelRows.length > 0) {
            const parts = toCompositionParts(panel.table, panelRows);
            const lead = [...parts].sort((left, right) => right.value - left.value)[0];
            if (lead) return { kind: 'composition', parts, lead };
        }

        const series = rows ? buildRunSeries(rows) : null;
        const metric = series?.metrics[0];
        if (!series || !metric) return { kind: 'none' };

        const values = seriesValues(series, metric.key);
        return { kind: 'metric', values, value: values[values.length - 1] ?? null, label: metric.label };
    }, [panel, panelQuery.data, rows]);
};

export default useRunHeadline;
