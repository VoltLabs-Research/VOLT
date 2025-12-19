import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DocumentListing, { type ColumnConfig, StatusBadge } from '@/components/organisms/common/DocumentListing';
import pluginApi from '@/services/api/plugin';
import trajectoryApi from '@/services/api/trajectory';
import analysisConfigApi from '@/services/api/analysis-config';
import { Skeleton } from '@mui/material';
import usePluginStore from '@/stores/plugins/plugin';
import useTeamStore from '@/stores/team/team';
import { RiDeleteBin6Line, RiEyeLine } from 'react-icons/ri';
import PerFrameListingModal from '@/components/organisms/common/PerFrameListingModal';
import { formatCellValue, normalizeRows, type ColumnDef } from '@/utilities/plugins/expression-utils';
import Select from '@/components/atoms/form/Select';

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

const buildColumns = (columnDefs: ColumnDef[], showTrajectory = false): ColumnConfig[] => {
    const cols: ColumnConfig[] = columnDefs.map(({ path, label }) => ({
        key: label, // Backend keys by label
        title: label,
        sortable: true,
        render: (_value: any, row: any) => {
            // Backend returns data keyed by label
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

const PluginListing = () => {
    const { pluginSlug, listingSlug, trajectoryId: paramTrajectoryId } = useParams();
    const navigate = useNavigate();
    const team = useTeamStore((s) => s.selectedTeam);

    const [trajectoryId, setTrajectoryId] = useState<string | undefined>(paramTrajectoryId);
    const [trajectories, setTrajectories] = useState<any[]>([]);

    const [columns, setColumns] = useState<ColumnConfig[]>([]);
    const [rows, setRows] = useState<any[]>([]);
    const [meta, setMeta] = useState<{ displayName?: string; trajectoryName?: string } | null>(null);
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

    // Update trajectoryId when URL param changes
    useEffect(() => {
        setTrajectoryId(paramTrajectoryId);
    }, [paramTrajectoryId]);

    // Fetch trajectories for filter
    useEffect(() => {
        if (!team?._id) return;
        trajectoryApi.getAll({ teamId: team._id })
            .then(data => setTrajectories(data))
            .catch(err => console.error('Failed to load trajectories', err));
    }, [team?._id]);

    const fetchPage = useCallback(async (nextPage: number) => {
        if (!pluginSlug || !listingSlug) {
            setError('Invalid listing parameters.');
            return;
        }

        // Need teamId if no trajectoryId
        if (!trajectoryId && !team?._id) {
            setError('Please select a team first.');
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
                pluginSlug,
                listingSlug,
                trajectoryId,
                { page: nextPage, limit: pageSize, teamId: team?._id }
            ) as ListingResponse;

            setMeta(payload.meta ?? null);
            const normalizedRows = normalizeRows(payload.rows ?? [], payload.meta?.columns ?? []);
            setColumns(buildColumns(payload.meta?.columns ?? [], !trajectoryId));

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
    }, [listingSlug, pluginSlug, trajectoryId, team?._id]);

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

        if (pluginSlug && listingSlug && (trajectoryId || team?._id)) {
            fetchPage(1);
        }
    }, [pluginSlug, listingSlug, trajectoryId, fetchPage, team?._id]);

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
                fetchPage(1);
            }
        }
    }, [fetchPage]);

    const getMenuOptions = useCallback((item: any) => {
        const options: any[] = [];

        // View atoms - for items with per-atom data
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

    const handleTrajectoryChange = (newTrajId: string) => {
        if (newTrajId) {
            navigate(`/dashboard/trajectory/${newTrajId}/plugins/${pluginSlug}/listing/${listingSlug}`);
        } else {
            navigate(`/dashboard/plugins/${pluginSlug}/listing/${listingSlug}`);
        }
    };

    const title = meta?.displayName ?? listingSlug ?? 'Listing';
    const breadcrumbs = useMemo(() => {
        const trail: (string | React.ReactNode)[] = ['Dashboard', 'Analysis'];
        trail.push(
            meta?.displayName ? (
                meta.displayName
            ) : (
                <Skeleton variant='text' width={200} sx={{ display: 'inline-block' }} />
            )
        );
        return trail;
    }, [meta]);

    return (
        <>
            <DocumentListing
                title={title}
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
                headerActions={
                    <Select
                        options={[
                            { value: '', title: 'All Trajectories' },
                            ...trajectories.map(t => ({ value: t._id, title: t.name }))
                        ]}
                        value={trajectoryId || ''}
                        onChange={handleTrajectoryChange}
                        placeholder='Select Trajectory'
                        showSelectionIcon={false}
                    />
                }
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

