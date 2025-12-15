import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import DocumentListing, { type ColumnConfig, StatusBadge } from '@/components/organisms/common/DocumentListing';
import pluginApi from '@/services/api/plugin';
import analysisConfigApi from '@/services/api/analysis-config';
import { Skeleton } from '@mui/material';
import usePluginStore from '@/stores/plugins/plugin';
import { RiDeleteBin6Line } from 'react-icons/ri';
import PerFrameListingModal from '@/components/organisms/common/PerFrameListingModal';
import { formatCellValue, normalizeRows, type ColumnDef } from '@/utilities/plugins/expression-utils';
import { getValueByPath } from '@/utilities/getValueByPath';

type ListingResponse = {
    meta: {
        displayName: string;
        listingKey: string;
        pluginId: string;
        listingUrl?: string;
        columns: ColumnDef[];
    };
    rows: any[];
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
};

// TODO: FIX MANIFEST USAGE
const buildColumns = (columnDefs: ColumnDef[], pluginId?: string, manifests?: any): ColumnConfig[] => {
    return columnDefs.map(({ path, label }) => {
        let isSelectField = false;
        if (path.startsWith('analysis.config.') && pluginId && manifest?.[pluginId]) {
            const argName = path.replace('analysis.config.', '');
            const manifest = manifests[pluginId];
            const argument = manifest?.entrypoint?.argument?.[argName];
            if (argument?.type === 'select') {
                isSelectField = true;
            }
        }

        return {
            key: path,
            title: label,
            sortable: true,
            render: (_value: any, row: any) => {
                const value = getValueByPath(row, path);
                if (isSelectField && value != null) {
                    return <StatusBadge status={String(value)} />;
                }
                return formatCellValue(value, path);
            },
            skeleton: isSelectField
                ? { variant: 'rounded', width: 90, height: 24 }
                : { variant: 'text', width: 120 }
        };
    });
};

const PluginListing = () => {
    const { pluginId, listingKey, trajectoryId } = useParams();
    const [columns, setColumns] = useState<ColumnConfig[]>([]);
    const [rows, setRows] = useState<any[]>([]);
    const [meta, setMeta] = useState<{ displayName?: string; trajectoryName?: string; pluginId?: string } | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pageSize = 50;

    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [perFrameConfig, setPerFrameConfig] = useState<any>(null);

    const pluginsBySlug = usePluginStore((s) => s.pluginsBySlug);
    const fetchPlugins = usePluginStore((s) => s.fetchPlugins);

    const fetchPage = useCallback(async (nextPage: number) => {
        if (!pluginId || !listingKey || !trajectoryId) {
            setError('Invalid listing parameters.');
            return;
        }

        setError(null);
        if (nextPage === 1) {
            setLoading(true);
        } else {
            setIsFetchingMore(true);
        }

        try {
            const payload = await pluginApi.getListing(
                pluginId,
                listingKey,
                trajectoryId,
                { page: nextPage, limit: pageSize }
            ) as ListingResponse;
            const listingMeta = { ...payload.meta, pluginId: payload.meta?.pluginId };
            setMeta(listingMeta ?? null);

            const normalizedRows = normalizeRows(payload.rows ?? [], payload.meta?.columns ?? []);
            setColumns(buildColumns(payload.meta?.columns ?? [], payload.meta?.pluginId, undefined));

            setRows((prev) => (nextPage === 1 ? normalizedRows : [...prev, ...normalizedRows]));
            setPage(nextPage);
            setHasMore(payload.hasMore ?? ((payload.page * payload.limit) < payload.total));
        } catch (err: any) {
            const message = err?.response?.data?.message || err?.message || 'Failed to load listing.';
            setError(message);
        } finally {
            setLoading(false);
            setIsFetchingMore(false);
        }
    }, [listingKey, pluginId, trajectoryId]);

    useEffect(() => {
        if (Object.keys(pluginsBySlug).length === 0) {
            fetchPlugins();
        }
    }, [pluginsBySlug, fetchPlugins]);

    useEffect(() => {
        setRows([]);
        setColumns([]);
        setMeta(null);
        setPage(1);
        setHasMore(false);

        if (pluginId && listingKey && trajectoryId) {
            fetchPage(1);
        }
    }, [pluginId, listingKey, trajectoryId, fetchPage]);

    const handleMenuAction = useCallback(async (action: string, item: any) => {
        if (action === 'delete') {
            const analysisId = item?.analysis?._id;
            if (!analysisId) {
                console.error('No analysis ID found for deletion');
                return;
            }

            if (!window.confirm('Delete this analysis? This cannot be undone.')) return;

            setRows((prev) => prev.filter((row) => row?.analysis?._id !== analysisId));

            try {
                await analysisConfigApi.delete(analysisId);
            } catch (e) {
                console.error('Failed to delete analysis:', e);
                fetchPage(1);
            }
        }
    }, [fetchPage]);

    const getMenuOptions = useCallback((item: any) => {
        const options: any[] = [];

        if (item?.analysis?._id) {
            options.push([
                'Delete Analysis',
                RiDeleteBin6Line,
                () => handleMenuAction('delete', item)
            ]);
        }

        return options;
    }, [handleMenuAction]);

    const title = meta?.displayName ?? listingKey ?? 'Listing';
    const breadcrumbs = useMemo(() => {
        const trail: (string | React.ReactNode)[] = ['Dashboard', 'Trajectories'];
        trail.push(
            meta?.trajectoryName ? (
                meta.trajectoryName
            ) : (
                <Skeleton variant='text' width={160} sx={{ display: 'inline-block' }} />
            )
        );
        trail.push(
            meta?.displayName ? (
                meta.displayName
            ) : (
                <Skeleton variant='text' width={200} sx={{ display: 'inline-block' }} />
            )
        );
        return trail;
    }, [meta, trajectoryId, listingKey]);

    return (
        <>
            <DocumentListing
                title={title}
                breadcrumbs={breadcrumbs}
                columns={columns}
                data={rows}
                isLoading={loading}
                emptyMessage={error ?? 'No documents found.'}
                enableInfinite
                hasMore={hasMore}
                isFetchingMore={isFetchingMore}
                onLoadMore={() => {
                    if (!loading && !isFetchingMore && hasMore) {
                        fetchPage(page + 1);
                    }
                }}
                onMenuAction={handleMenuAction}
                getMenuOptions={getMenuOptions}
            />
            {selectedItem && perFrameConfig && (
                <PerFrameListingModal
                    item={selectedItem}
                    config={perFrameConfig}
                    onClose={() => {
                        setSelectedItem(null);
                        setPerFrameConfig(null);
                    }}
                />
            )}
        </>
    );
};

export default PluginListing;
