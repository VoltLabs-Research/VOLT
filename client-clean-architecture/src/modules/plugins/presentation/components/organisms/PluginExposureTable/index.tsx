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
import DocumentListing, { type ColumnConfig } from '@/shared/presentation/components/organisms/common/DocumentListing';
import { usePlugin, usePluginListing } from '@/modules/plugins/presentation/hooks/use-plugin-queries';
import { useDeleteAnalysisConfig } from '@/modules/analysis/presentation/hooks/use-analysis-queries';
import { RiDeleteBin6Line, RiEyeLine } from 'react-icons/ri';
import { formatCellValue, normalizeRows, type ColumnDef } from '@/modules/plugins/presentation/utilities/expression-utils';
import PluginCompactTable from '@/modules/plugins/presentation/components/organisms/PluginCompactTable';
import useConfirm from '@/shared/presentation/hooks/ui/use-confirm';
import '@/modules/plugins/presentation/components/organisms/PluginExposureTable/PluginExposureTable.css';

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
    analysisId?: string;
    teamId?: string;
    compact?: boolean;
    showTrajectoryColumn?: boolean;
    headerActions?: React.ReactNode;
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
    analysisId,
    teamId,
    compact = false,
    showTrajectoryColumn,
    headerActions,
    onDataReady
}: PluginExposureTableProps) => {
    const navigate = useNavigate();
    const { confirm } = useConfirm();
    const pageSize = compact ? 20 : 50;

    const { data: plugin } = usePlugin(pluginSlug);
    const {
        rows: allRows,
        listingMeta,
        isLoading,
        isFetchingNextPage,
        fetchNextPage,
        hasNextPage,
        error: fetchError
    } = usePluginListing({
        pluginSlug,
        listingSlug,
        trajectoryId,
        teamId,
        limit: pageSize
    });

    const deleteAnalysisConfig = useDeleteAnalysisConfig();

    const columnDefs = useMemo(() => {
        if (!plugin || !listingSlug) return [];
        return extractColumnsFromPlugin(plugin, listingSlug);
    }, [plugin, listingSlug]);

    const columns = useMemo(() => {
        const shouldShowTrajectory = showTrajectoryColumn ?? !trajectoryId;
        return buildColumns(columnDefs, shouldShowTrajectory);
    }, [columnDefs, showTrajectoryColumn, trajectoryId]);

    const normalizedRows = useMemo(() => {
        return normalizeRows(allRows, columnDefs);
    }, [allRows, columnDefs]);

    const displayRows = useMemo(() => {
        if (!analysisId) return normalizedRows;
        return normalizedRows.filter((r) => r.analysisId === analysisId);
    }, [normalizedRows, analysisId]);

    useEffect(() => {
        if (onDataReady) {
            onDataReady(columns, displayRows);
        }
    }, [columns, displayRows, onDataReady]);

    const handleMenuAction = useCallback(async (action: string, item: any) => {
        if (action === 'delete') {
            const analysisId = item?.analysisId;
            if (!analysisId) return;

            const isConfirmed = await confirm('Delete this analysis? This cannot be undone.');
            if (!isConfirmed) return;

            try {
                await deleteAnalysisConfig.mutateAsync(analysisId);
            } catch (e) {
                console.error('Failed to delete analysis:', e);
            }
        }
    }, [confirm, deleteAnalysisConfig]);

    const error = fetchError ? (fetchError as any).message || 'Failed to load listing.' : null;

    const lifecycleProps = {
        listingMeta,
        onLoadMore: fetchNextPage,
        hasMore: hasNextPage,
        isFetchingMore: isFetchingNextPage
    };

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
                data={displayRows}
                hasMore={hasNextPage}
                isLoading={isLoading}
                isFetchingMore={isFetchingNextPage}
                onLoadMore={fetchNextPage}
                error={error}
                onDataReady={onDataReady}
            />
        );
    }

    return (
        <DocumentListing
            title={listingSlug}
            columns={columns}
            data={displayRows}
            isLoading={isLoading}
            emptyMessage={error ?? 'No documents found.'}
            hasMore={hasNextPage}
            isFetchingMore={isFetchingNextPage}
            onLoadMore={fetchNextPage}
            onMenuAction={handleMenuAction}
            getMenuOptions={getMenuOptions}
            headerActions={headerActions}
        />
    );
};

export default PluginExposureTable;
