import { useMemo, useState } from 'react';
import { usePageTitle } from '@/hooks/core/use-page-title';
import DocumentListing, { type ColumnConfig, formatNumber } from '@/components/organisms/common/DocumentListing';
import { useTeamStore } from '@/features/team/stores';
import { useUIStore } from '@/stores/slices/ui';
import simulationCellApi from '@/features/simulation-cell/api';
import { formatDistanceToNow } from 'date-fns';
import useListingLifecycle from '@/hooks/common/use-listing-lifecycle';

interface ListingMeta {
    page: number;
    limit: number;
    hasMore: boolean;
    total?: number;
    nextCursor?: string | null;
}

const SimulationCellsListing = () => {
    usePageTitle('Simulation Cells');
    const team = useTeamStore((s) => s.selectedTeam);
    const searchQuery = useUIStore((s) => s.query);

    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [listingMeta, setListingMeta] = useState<ListingMeta>({
        page: 1, limit: 20, hasMore: false, total: 0
    });

    const lifecycleProps = useListingLifecycle({
        data,
        isLoading,
        isFetchingMore,
        listingMeta,
        fetchData: async (params: any) => {
            if (!team?._id) return;

            try {
                if (params.page === 1 && !params.append) setIsLoading(true);
                else setIsFetchingMore(true);

                const res = await simulationCellApi.getAll(team._id, { ...params, search: searchQuery });

                // res is now the response body, so correct unpacking depends on what the API returns.
                // API getAll now returns response.data (the body).
                // But the controller currently returns { status: 'success', data: [] }.
                // BaseResponse.paginated returns { status: 'success', data: [...], results: ... }.
                // Let's assume the controller will eventually return paginated response.
                // For now, if API returns `response.data` (the body), we access it directly.

                // If API returns `response.data` (body), then `res` IS the body.
                // The API getAll implementation I wrote returns `response.data`.
                // So `res` = { status: 'success', data: ..., ... }

                const { data: results, ...pagination } = res;


                if (params.append) {
                    setData(prev => [...prev, ...results]);
                } else {
                    setData(results);
                }

                setListingMeta({
                    page: pagination.page,
                    limit: pagination.limit,
                    hasMore: pagination.page < pagination.totalPages,
                    total: pagination.total
                });

            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
                setIsFetchingMore(false);
            }
        },
        initialFetchParams: { page: 1, limit: 20, search: searchQuery },
        dependencies: [team?._id, searchQuery]
    });

    const columns: ColumnConfig[] = useMemo(() => [
        {
            title: 'Trajectory',
            key: 'trajectory.name',
            render: (_, row) => row.trajectory.name,
            skeleton: { variant: 'text', width: 120 }
        },
        {
            title: 'Timestep',
            key: 'timestep',
            render: (_, row) => row.timestep,
            skeleton: { variant: 'text', width: 80 }
        },
        {
            title: 'Width',
            key: 'boundingBox.width',
            render: (_, row) => formatNumber(row.boundingBox?.width),
            skeleton: { variant: 'text', width: 80 }
        },
        {
            title: 'Height',
            key: 'boundingBox.height',
            render: (_, row) => formatNumber(row.boundingBox?.height),
            skeleton: { variant: 'text', width: 80 }
        },
        {
            title: 'Length',
            key: 'boundingBox.length',
            render: (_, row) => formatNumber(row.boundingBox?.length),
            skeleton: { variant: 'text', width: 80 }
        },
        {
            title: 'Periodic',
            key: 'geometry.periodic_boundary_conditions',
            render: (_, row) => {
                const { x, y, z } = row.geometry?.periodic_boundary_conditions || {};
                return `X: ${x ? 'Yes' : 'No'}, Y: ${y ? 'Yes' : 'No'}, Z: ${z ? 'Yes' : 'No'}`;
            },
            skeleton: { variant: 'text', width: 120 }
        },
        {
            title: 'Created At',
            key: 'createdAt',
            render: (v) => formatDistanceToNow(new Date(v), { addSuffix: true }),
            skeleton: { variant: 'text', width: 90 }
        }
    ], []);

    return (
        <DocumentListing
            title='Simulation Cells'
            columns={columns}
            data={data}
            isLoading={isLoading}
            emptyMessage='No simulation cells found'
            {...lifecycleProps}
        />
    );
};

export default SimulationCellsListing;
