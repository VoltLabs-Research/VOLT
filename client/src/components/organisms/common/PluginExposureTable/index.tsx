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
import DocumentListingTable from '@/components/molecules/common/DocumentListingTable';
import pluginApi from '@/services/api/plugin/plugin';
import analysisConfigApi from '@/services/api/analysis/analysis';
import { RiDeleteBin6Line, RiEyeLine } from 'react-icons/ri';
import { formatCellValue, normalizeRows, type ColumnDef } from '@/utilities/plugins/expression-utils';
import { NodeType } from '@/types/plugin';
import { usePluginStore } from '@/stores/slices/plugin/plugin-slice';
import PluginCompactTable from '../PluginCompactTable';
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

const extractColumnsFromWorkflow = (plugin: any, listingSlug: string): ColumnDef[] => {
    const nodes = plugin?.workflow?.nodes || [];
    const edges = plugin?.workflow?.edges || [];

    const exposureNode = nodes.find((n: any) => n.type === NodeType.EXPOSURE && n.data?.exposure?.name === listingSlug);
    if (!exposureNode) return [];

    const outMap = new Map<string, string[]>();
    for (const e of edges) {
        const arr = outMap.get(e.source) || [];
        arr.push(e.target);
        outMap.set(e.source, arr);
    }

    const q = [exposureNode.id];
    const visited = new Set<string>();

    while (q.length) {
        const id = q.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);

        const children = outMap.get(id) || [];
        for (const childId of children) {
            const child = nodes.find((x: any) => x.id === childId);
            if (!child) continue;

            if (child.type === NodeType.VISUALIZERS && child.data?.visualizers?.listing) {
                const listingDef = child.data.visualizers.listing || {};
                const entries = Object.entries(listingDef);
                if (entries.length) {
                    return entries.map(([path, label]) => ({ path, label: String(label) }));
                }
            }

            q.push(childId);
        }
    }

    return [];
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

    const [columns, setColumns] = useState<ColumnConfig[]>([]);
    const [rows, setRows] = useState<any[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pageSize = compact ? 20 : 50;

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
        return extractColumnsFromWorkflow(plugin, listingSlug);
    }, [pluginsBySlug, pluginSlug, listingSlug]);

    // Track if initial fetch has been done for current params
    const fetchedForRef = useRef<string | null>(null);

    const fetchBatch = useCallback(async (after?: string | null) => {
        if (!pluginSlug || !listingSlug) {
            setError('Invalid listing parameters.');
            return;
        }

        if (!trajectoryId && !teamId) {
            setError('Please select a team or trajectory first.');
            return;
        }

        // Guard against duplicate initial fetches (StrictMode)
        const paramsKey = `${pluginSlug}:${listingSlug}:${trajectoryId || ''}:${teamId || ''}`;
        if (!after) {
            if (fetchedForRef.current === paramsKey && rows.length > 0) {
                return;
            }
            fetchedForRef.current = paramsKey;
        }

        setError(null);
        if (!after) {
            setLoading(true);
        } else {
            setIsFetchingMore(true);
        }

        try {
            const payload = await pluginApi.getListing(
                pluginSlug,
                listingSlug,
                trajectoryId,
                { limit: pageSize, teamId }
            ) as ListingResponse;

            const defs = (payload as any)?.meta?.columns && Array.isArray((payload as any).meta.columns)
                ? (payload as any).meta.columns as ColumnDef[]
                : columnDefs;

            const shouldShowTrajectory = showTrajectoryColumn ?? !trajectoryId;
            setColumns(buildColumns(defs, shouldShowTrajectory));

            const normalizedRows = normalizeRows(payload.rows ?? [], defs);
            setRows((prev) => (!after ? normalizedRows : [...prev, ...normalizedRows]));

            setHasMore(Boolean(payload.hasMore));
            setNextCursor(payload.nextCursor ?? null);
        } catch (err: any) {
            const message = err?.response?.data?.message || err?.message || 'Failed to load listing.';
            setError(message);
        } finally {
            setLoading(false);
            setIsFetchingMore(false);
        }
    }, [listingSlug, pluginSlug, trajectoryId, teamId, columnDefs, pageSize, showTrajectoryColumn]);

    useEffect(() => {
        setRows([]);
        setColumns([]);
        setHasMore(false);
        setNextCursor(null);

        if (pluginSlug && listingSlug && (trajectoryId || teamId)) {
            fetchBatch(null);
        }
    }, [pluginSlug, listingSlug, trajectoryId, teamId, fetchBatch]);

    const handleMenuAction = useCallback(async (action: string, item: any) => {
        if (action === 'delete') {
            const analysisId = item?.analysisId;
            if (!analysisId) {
                console.error('No analysis ID found for deletion');
                return;
            }

            if (!window.confirm('Delete this analysis? This cannot be undone.')) return;

            setRows((prev) => prev.filter((row) => row?.analysisId !== analysisId));

            try {
                await analysisConfigApi.delete(analysisId);
            } catch (e) {
                console.error('Failed to delete analysis:', e);
                fetchBatch(null);
            }
        }
    }, [fetchBatch]);

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

        if (item?.analysisId) {
            options.push([
                'Delete Analysis',
                RiDeleteBin6Line,
                () => handleMenuAction('delete', item)
            ]);
        }

        return options;
    }, [handleMenuAction, navigate]);

    const handleLoadMore = useCallback(() => {
        if (!loading && !isFetchingMore && hasMore && nextCursor) {
            fetchBatch(nextCursor);
        }
    }, [loading, isFetchingMore, hasMore, nextCursor, fetchBatch]);

    if (compact) {
        return (
            <PluginCompactTable
                columns={columns}
                data={rows}
                hasMore={hasMore}
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
            enableInfinite
            hasMore={hasMore}
            isFetchingMore={isFetchingMore}
            onLoadMore={handleLoadMore}
            onMenuAction={handleMenuAction}
            getMenuOptions={getMenuOptions}
            headerActions={headerActions}
        />
    );
};

export default PluginExposureTable;
