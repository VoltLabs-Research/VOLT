import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import DocumentListing, { type ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import { formatCellValue, normalizeRows, type ColumnDef } from '@/modules/plugin/presentation/utilities/expression-utils';
import { usePluginStore } from '../../../stores';
import PluginCompactTable from '@/modules/plugin/presentation/components/organisms/PluginCompactTable';
import useListingLifecycle, { type ListingMeta } from '@/shared/presentation/hooks/use-listing-lifecycle';
import usePluginUseCases from '@/modules/plugin/presentation/hooks/use-plugin-use-cases';
import usePluginListing from '@/modules/plugin/presentation/hooks/use-plugin-listing';
import '@/modules/plugin/presentation/components/organisms/PluginExposureTable/PluginExposureTable.css';

export interface PluginExposureTableProps {
    pluginSlug: string;
    listingSlug: string;
    trajectoryId?: string;
    analysisId?: string;
    teamId?: string;
    compact?: boolean;
    showTrajectoryColumn?: boolean;
    headerActions?: ReactNode;
    onDataReady?: (columns: any[], data: any[]) => void;
}

const buildColumns = (columnDefs: ColumnDef[], showTrajectory = false): ColumnConfig[] => {
    const cols: ColumnConfig[] = columnDefs.map(({ path, label }) => ({
        key: label,
        title: label,
        sortable: true,
        render: (_value: any, row: any) => {
            const value = row[path];
            return formatCellValue(value, path);
        },
        skeleton: { variant: 'text' as const, width: 120 }
    }));

    if (showTrajectory) {
        cols.unshift({
            key: 'trajectoryName',
            title: 'Trajectory',
            sortable: false,
            render: (_value: any, row: any) => row.trajectoryName || '-',
            skeleton: { variant: 'text' as const, width: 120 }
        });
    }

    return cols;
};

const extractColumnsFromPlugin = (plugin: any, listingSlug: string): ColumnDef[] => {
    if (!plugin?.exposures) return [];

    const exposure = plugin.exposures.find((e: any) => e.name === listingSlug);
    if (!exposure?.listing) return [];

    return Object.entries(exposure.listing).map(([path, label]) => ({
        path,
        label: String(label)
    }));
};

const PluginExposureTable = ({
    pluginSlug,
    listingSlug,
    trajectoryId,
    analysisId,
    teamId,
    compact = false,
    showTrajectoryColumn,
    headerActions,
    onDataReady
}: PluginExposureTableProps) => {
    const { pluginListingRepository } = usePluginUseCases();
    const listingHook = usePluginListing({
        pluginSlug,
        listingSlug,
        trajectoryId,
        analysisId,
        teamId,
        showTrajectoryColumn
    });
    const pageSize = compact ? 20 : 50;

    const [columns, setColumns] = useState<ColumnConfig[]>([]);
    const [rows, setRows] = useState<any[]>([]);
    const [listingMeta, setListingMeta] = useState<ListingMeta>({
        page: 1,
        limit: pageSize,
        hasMore: false,
        nextCursor: null
    });
    const [loading, setLoading] = useState(false);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const pluginsBySlug = usePluginStore((s) => s.pluginsBySlug);
    const fetchPlugins = usePluginStore((s) => s.fetchPlugins);

    useEffect(() => {
        if (Object.keys(pluginsBySlug).length === 0) {
            fetchPlugins();
        }
    }, [pluginsBySlug, fetchPlugins]);

    const columnDefs = useMemo(() => {
        if (!pluginSlug || !listingSlug) return [];
        const plugin = pluginsBySlug[pluginSlug];
        if (!plugin) return [];
        return extractColumnsFromPlugin(plugin, listingSlug);
    }, [pluginsBySlug, pluginSlug, listingSlug]);

    const fetchBatch = useCallback(async (params: any) => {
        const { force, page } = params;
        const isInitial = page === 1;

        if (!pluginSlug || !listingSlug) {
            setError('Invalid listing parameters.');
            return;
        }

        if (!trajectoryId && !teamId) {
            setError('Please select a team or trajectory first.');
            return;
        }

        setError(null);
        if (isInitial || force) {
            setLoading(true);
        } else {
            setIsFetchingMore(true);
        }

        try {
            const payload = await pluginListingRepository.getListing({
                pluginSlug,
                listingSlug,
                trajectoryId,
                limit: pageSize,
                page
            }) as any;

            const defs = payload?._meta?.columns && Array.isArray(payload._meta.columns) && payload._meta.columns.length > 0
                ? payload._meta.columns as ColumnDef[]
                : columnDefs;

            const shouldShowTrajectory = showTrajectoryColumn ?? !trajectoryId;
            setColumns(buildColumns(defs, shouldShowTrajectory));

            const normalizedRows = normalizeRows(payload.data ?? [], defs);

            setListingMeta(prev => ({
                ...prev,
                page,
                hasMore: Boolean(payload.pagination?.hasMore),
                nextCursor: null
            }));

            setRows((prev) => (isInitial && !params.append ? normalizedRows : [...prev, ...normalizedRows]));
        } catch (err: any) {
            const message = err?.response?.data?.message || err?.message || 'Failed to load listing.';
            setError(message);
        } finally {
            setLoading(false);
            setIsFetchingMore(false);
        }
    }, [listingSlug, pluginSlug, trajectoryId, teamId, columnDefs, pageSize, showTrajectoryColumn, pluginListingRepository]);

    const { handleLoadMore } = useListingLifecycle({
        data: rows,
        isLoading: loading,
        isFetchingMore,
        listingMeta,
        fetchData: fetchBatch,
        initialFetchParams: { page: 1, limit: pageSize },
        dependencies: [pluginSlug, listingSlug, trajectoryId, teamId],
        skipInitialFetch: !compact,
        onReset: () => {
            setRows([]);
            setColumns([]);
            setListingMeta(prev => ({ ...prev, page: 1, hasMore: false, nextCursor: null }));
        }
    });

    const displayRows = useMemo(() => {
        if (!analysisId) return rows;
        return rows.filter((r) => r.analysisId === analysisId);
    }, [rows, analysisId]);

    useEffect(() => {
        if (!onDataReady || !compact) return;
        onDataReady(columns, displayRows);
    }, [columns, displayRows, onDataReady, compact]);

    if (compact) {
        return (
            <PluginCompactTable
                columns={columns}
                data={displayRows}
                hasMore={listingMeta.hasMore}
                isLoading={loading}
                isFetchingMore={isFetchingMore}
                onLoadMore={handleLoadMore}
                error={error}
                onDataReady={onDataReady}
            />
        );
    }

    return (
        <DocumentListing
            title={listingSlug}
            fetchData={listingHook.fetchData}
            context={listingHook.context}
            enabled={listingHook.isEnabled}
            columns={listingHook.columns}
            getMenuOptions={listingHook.getMenuOptions}
            headerActions={headerActions}
        />
    );
};

export default PluginExposureTable;
