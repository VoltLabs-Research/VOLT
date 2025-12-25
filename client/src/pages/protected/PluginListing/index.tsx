import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DocumentListing, { type ColumnConfig } from '@/components/organisms/common/DocumentListing';
import pluginApi from '@/services/api/plugin';
import trajectoryApi from '@/services/api/trajectory';
import analysisConfigApi from '@/services/api/analysis-config';
import { Skeleton } from '@mui/material';
import usePluginStore from '@/stores/plugins/plugin';
import useTeamStore from '@/stores/team/team';
import { RiDeleteBin6Line, RiEyeLine } from 'react-icons/ri';
import PerFrameListingModal from '@/components/organisms/common/PerFrameListingModal';
import { formatCellValue, normalizeRows, type ColumnDef } from '@/utilities/plugins/expression-utils';
import { NodeType } from '@/types/plugin';
import Select from '@/components/atoms/form/Select';

type ListingResponse = {
    meta?: any;
    rows: any[];
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
};

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

    if(showTrajectory){
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
    if(!exposureNode) return [];

    const outMap = new Map<string, string[]>();
    for(const e of edges){
        const arr = outMap.get(e.source) || [];
        arr.push(e.target);
        outMap.set(e.source, arr);
    }

    const q = [exposureNode.id];
    const visited = new Set<string>();

    while(q.length){
        const id = q.shift()!;
        if(visited.has(id)) continue;
        visited.add(id);

        const children = outMap.get(id) || [];
        for(const childId of children){
            const child = nodes.find((x: any) => x.id === childId);
            if(!child) continue;

            if(child.type === NodeType.VISUALIZERS && child.data?.visualizers?.listing){
                const listingDef = child.data.visualizers.listing || {};
                const entries = Object.entries(listingDef);
                if(entries.length){
                    return entries.map(([path, label]) => ({ path, label: String(label) }));
                }
            }

            q.push(childId);
        }
    }

    return [];
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
    const [hasMore, setHasMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pageSize = 50;

    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [perFrameConfig, setPerFrameConfig] = useState<any>(null);

    const pluginsBySlug = usePluginStore((s) => s.pluginsBySlug);
    const fetchPlugins = usePluginStore((s) => s.fetchPlugins);

    useEffect(() => {
        setTrajectoryId(paramTrajectoryId);
    }, [paramTrajectoryId]);

    useEffect(() => {
        if(!team?._id) return;
        trajectoryApi.getAll({ teamId: team._id })
            .then(data => setTrajectories(data))
            .catch(err => console.error('Failed to load trajectories', err));
    }, [team?._id]);

    useEffect(() => {
        if(Object.keys(pluginsBySlug).length === 0) {
            fetchPlugins();
        }
    }, [pluginsBySlug, fetchPlugins]);

    const columnDefs = useMemo(() => {
        if(!pluginSlug || !listingSlug) return [];
        const plugin = pluginsBySlug[pluginSlug];
        if(!plugin) return [];
        return extractColumnsFromWorkflow(plugin, listingSlug);
    }, [pluginsBySlug, pluginSlug, listingSlug]);

    const fetchBatch = useCallback(async(after?: string | null) => {
        if(!pluginSlug || !listingSlug){
            setError('Invalid listing parameters.');
            return;
        }

        if(!trajectoryId && !team?._id){
            setError('Please select a team first.');
            return;
        }

        setError(null);
        if(!after){
            setLoading(true);
        }else{
            setIsFetchingMore(true);
        }

        try{
            const payload = await pluginApi.getListing(
                pluginSlug,
                listingSlug,
                trajectoryId,
                { limit: pageSize, teamId: team?._id, sort: 'desc', after: after || undefined }
            ) as ListingResponse;

            const defs = (payload as any)?.meta?.columns && Array.isArray((payload as any).meta.columns)
                ? (payload as any).meta.columns as ColumnDef[]
                : columnDefs;

            setMeta((prev) => prev ?? { displayName: listingSlug });
            setColumns(buildColumns(defs, !trajectoryId));

            const normalizedRows = normalizeRows(payload.rows ?? [], defs);
            setRows((prev) => (!after ? normalizedRows : [...prev, ...normalizedRows]));

            setHasMore(Boolean(payload.hasMore));
            setNextCursor(payload.nextCursor ?? null);
        }catch(err: any){
            const message = err?.response?.data?.message || err?.message || 'Failed to load listing.';
            setError(message);
        }finally{
            setLoading(false);
            setIsFetchingMore(false);
        }
    }, [listingSlug, pluginSlug, trajectoryId, team?._id, columnDefs]);

    useEffect(() => {
        setRows([]);
        setColumns([]);
        setMeta(null);
        setHasMore(false);
        setNextCursor(null);

        if(pluginSlug && listingSlug && (trajectoryId || team?._id)) {
            fetchBatch(null);
        }
    }, [pluginSlug, listingSlug, trajectoryId, fetchBatch, team?._id]);

    const handleMenuAction = useCallback(async(action: string, item: any) => {
        if(action === 'delete'){
            const analysisId = item?.analysisId;
            if(!analysisId){
                console.error('No analysis ID found for deletion');
                return;
            }

            if(!window.confirm('Delete this analysis? This cannot be undone.')) return;

            setRows((prev) => prev.filter((row) => row?.analysisId !== analysisId));

            try{
                await analysisConfigApi.delete(analysisId);
            }catch(e){
                console.error('Failed to delete analysis:', e);
                fetchBatch(null);
            }
        }
    }, [fetchBatch]);

    const getMenuOptions = useCallback((item: any) => {
        const options: any[] = [];

        if(item?.trajectoryId && item?.analysisId && item?.exposureId && item?.timestep !== undefined){
            options.push([
                'View Atoms',
                RiEyeLine,
                () => navigate(
                    `/dashboard/trajectory/${item.trajectoryId}/analysis/${item.analysisId}/atoms/${item.exposureId}?timestep=${item.timestep}`
                )
            ]);
        }

        if(item?.analysisId){
            options.push([
                'Delete Analysis',
                RiDeleteBin6Line,
                () => handleMenuAction('delete', item)
            ]);
        }

        return options;
    }, [handleMenuAction, navigate]);

    const handleTrajectoryChange = (newTrajId: string) => {
        if(newTrajId){
            navigate(`/dashboard/trajectory/${newTrajId}/plugins/${pluginSlug}/listing/${listingSlug}`);
        }else{
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
                    if(!loading && !isFetchingMore && hasMore && nextCursor){
                        fetchBatch(nextCursor);
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
