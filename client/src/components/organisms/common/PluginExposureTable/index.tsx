/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DocumentListing, { type ColumnConfig } from '@/components/organisms/common/DocumentListing';
import pluginApi from '@/services/api/plugin/plugin';
import analysisConfigApi from '@/services/api/analysis/analysis';
import { RiDeleteBin6Line, RiEyeLine } from 'react-icons/ri';
import { formatCellValue, normalizeRows, type ColumnDef } from '@/utilities/plugins/expression-utils';
import { usePluginStore } from '@/stores/slices/plugin/plugin-slice';
import PluginCompactTable from '../PluginCompactTable';
import useConfirm from '@/hooks/ui/use-confirm';
import useListingLifecycle, { type ListingMeta } from '@/hooks/common/use-listing-lifecycle';
import './PluginExposureTable.css';

type ListingResponse = {
    meta?: any;
    rows: any[];
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
};

export interface PluginExposureTableProps {
    pluginSlug: string;
    listingSlug: string;
    trajectoryId?: string;
    teamId?: string;
    compact?: boolean;
    showTrajectoryColumn?: boolean;
    headerActions?: React.ReactNode;
}

const buildColumns = (columnDefs: ColumnDef[], showTrajectory = false): ColumnConfig[] => {
    const cols: ColumnConfig[] = columnDefs.map(({ path, label }) => ({
        key: label,
        title: label,
        sortable: true,
        render: (_value: any, row: any) => {
            const value = row[label];
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

// Use backend-computed exposures.listing instead of workflow traversal
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
    teamId,
    compact = false,
    showTrajectoryColumn,
    headerActions
}: PluginExposureTableProps) => {
    const navigate = useNavigate();
    const { confirm } = useConfirm();
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

    // Use backend-computed exposures.listing instead of workflow traversal
    const columnDefs = useMemo(() => {
        if (!pluginSlug || !listingSlug) return [];
        const plugin = pluginsBySlug[pluginSlug];
        if (!plugin) return [];
        return extractColumnsFromPlugin(plugin, listingSlug);
    }, [pluginsBySlug, pluginSlug, listingSlug]);


    // Track if initial fetch has been done for current params
    const fetchedForRef = useRef<string | null>(null);

    const fetchBatch = useCallback(async (params: any) => {
        const { cursor, force, page } = params;
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
            const payload = await pluginApi.getListing(
                pluginSlug,
                listingSlug,
                trajectoryId,
                {
                    limit: pageSize,
                    teamId,
                    cursor: cursor ?? undefined
                }
            ) as ListingResponse;

            const defs = (payload as any)?.meta?.columns && Array.isArray((payload as any).meta.columns)
                ? (payload as any).meta.columns as ColumnDef[]
                : columnDefs;

            const shouldShowTrajectory = showTrajectoryColumn ?? !trajectoryId;
            setColumns(buildColumns(defs, shouldShowTrajectory));

            const normalizedRows = normalizeRows(payload.rows ?? [], defs);

            setListingMeta(prev => ({
                ...prev,
                page: page, // Hook manages page counter
                hasMore: Boolean(payload.hasMore),
                nextCursor: payload.nextCursor ?? null
            }));

            setRows((prev) => (isInitial && !params.append ? normalizedRows : [...prev, ...normalizedRows]));
        } catch (err: any) {
            const message = err?.response?.data?.message || err?.message || 'Failed to load listing.';
            setError(message);
        } finally {
            setLoading(false);
            setIsFetchingMore(false);
        }
    }, [listingSlug, pluginSlug, trajectoryId, teamId, columnDefs, pageSize, showTrajectoryColumn]);

    // Reset columns for new listing
    useEffect(() => {
        setRows([]);
        setColumns([]);
        setListingMeta(prev => ({ ...prev, page: 1, hasMore: false, nextCursor: null }));
    }, [pluginSlug, listingSlug, trajectoryId, teamId]);

    const { handleLoadMore } = useListingLifecycle({
        data: rows,
        isLoading: loading,
        isFetchingMore,
        listingMeta,
        fetchData: fetchBatch,
        initialFetchParams: { page: 1, limit: pageSize },
        dependencies: [pluginSlug, listingSlug, trajectoryId, teamId]
    });



    const handleMenuAction = useCallback(async (action: string, item: any) => {
        if (action === 'delete') {
            const analysisId = item?.analysisId;
            if (!analysisId) {
                console.error('No analysis ID found for deletion');
                return;
            }

            const isConfirmed = await confirm('Delete this analysis? This cannot be undone.');
            if (!isConfirmed) return;

            setRows((prev) => prev.filter((row) => row?.analysisId !== analysisId));

            try {
                await analysisConfigApi.delete(analysisId);
            } catch (e) {
                console.error('Failed to delete analysis:', e);
                fetchBatch({ page: 1, force: true });
            }
        }
    }, [fetchBatch, confirm]);

    const getMenuOptions = useCallback((item: any) => {
        const options: any[] = [];

        if (item?.trajectoryId && item?.analysisId && item?.exposureId && item?.timestep !== undefined) {
            options.push([
                'View Atoms',
                RiEyeLine,
                () => navigate(
                    `/dashboard/trajectory/${item.trajectoryId}/analysis/${item.analysisId}/atoms/${item.exposureId}?timestep=${item.timestep}`
                )
            ]);
        }

        // Delete option - removes all rows for this analysis
        if (item?.analysisId) {
            options.push([
                'Delete',
                RiDeleteBin6Line,
                () => handleMenuAction('delete', item)
            ]);
        }

        return options;
    }, [handleMenuAction, navigate]);



    if (compact) {
        return (
            <PluginCompactTable
                columns={columns}
                data={rows}
                hasMore={listingMeta.hasMore}
                isLoading={loading}
                isFetchingMore={isFetchingMore}
                onLoadMore={handleLoadMore}
                error={error}
            />
        );
    }

    return (
        <DocumentListing
            title={listingSlug}
            columns={columns}
            data={rows}
            isLoading={loading}
            emptyMessage={error ?? 'No documents found.'}
            hasMore={listingMeta.hasMore}
            isFetchingMore={isFetchingMore}
            onLoadMore={handleLoadMore}
            onMenuAction={handleMenuAction}
            getMenuOptions={getMenuOptions}
            headerActions={headerActions}
        />
    );
};

export default PluginExposureTable;
