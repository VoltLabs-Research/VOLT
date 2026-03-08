import { useNavigate } from 'react-router-dom';
import { RiRefreshLine } from 'react-icons/ri';
import { analysisQuery } from '@/modules/analysis/hooks/queries';
import useRetryFailedFrames from '@/modules/analysis/hooks/use-retry-failed-frames';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import { showPromise } from '@/shared/presentation/hooks/toast';
import DocumentListing, { type ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import { dateColumn } from '@/shared/presentation/utilities/column-presets';

const COLUMNS: ColumnConfig[] = [
    {
        key: 'trajectory.name',
        title: 'Trajectory',
        sortable: true,
        render: (_, row) => (row as Analysis).trajectory.name,
        skeleton: { variant: 'text', width: 140 }
    },
    {
        key: 'plugin',
        title: 'Plugin',
        sortable: true,
        render: (value) => String(value),
        skeleton: { variant: 'text', width: 110 }
    },
    {
        key: 'totalFrames',
        title: 'Total Frames',
        sortable: true,
        render: (value) => (value as number).toLocaleString(),
        skeleton: { variant: 'text', width: 90 }
    },
    dateColumn('startedAt', 'Started At'),
    dateColumn('finishedAt', 'Finished At'),
    dateColumn('createdAt', 'Created')
];

const AnalysesListing = () => {
    const navigate = useNavigate();

    const deleteAnalysisMutation = analysisQuery.useDeleteMutation();
    const retryFailedFrames = useRetryFailedFrames();
    const fetchAnalysesData = (params: PaginationParams): Promise<PaginatedResponse<Analysis>> => analysisQuery.useListQuery.fetch(params);

    const { getMenuOptions } = useListingActions<Analysis>({
        actions: {
            view: {
                label: 'View Scene',
                handler: ({ item: analysis }) => {
                    navigate(`/canvas/${analysis.trajectory._id}`);
                },
                requiredPermission: 'analysis:read'
            },
            retry: {
                label: 'Retry Failed Frames',
                icon: RiRefreshLine,
                handler: async ({ item: analysis }) => {
                    await retryFailedFrames(analysis._id);
                },
                requiredPermission: 'analysis:update'
            },
            delete: {
                handler: async ({ item: analysis }) => {
                    await showPromise(deleteAnalysisMutation.mutateAsync(analysis._id), {
                        loading: { title: 'Deleting analysis...' },
                        success: { title: 'Analysis deleted' },
                        error: { title: 'Failed to delete analysis' }
                    });
                },
                confirm: ({ selectedItems }) => (
                    selectedItems.length === 1
                        ? 'Delete this analysis? This cannot be undone.'
                        : `Delete ${selectedItems.length} analyses? This cannot be undone.`
                ),
                requiredPermission: 'analysis:delete'
            }
        }
    });

    const columns: ColumnConfig[] = COLUMNS;

    return (
        <DocumentListing<Analysis>
            title='Analyses'
            queryKey={analysisQuery.QUERY_KEYS.all()}
            columns={columns}
            fetchData={fetchAnalysesData}
            defaultLimit={20}
            getMenuOptions={getMenuOptions}
            emptyMessage='No analyses found'
        />
    );
};

export default AnalysesListing;
