import { analysisQuery } from '@/modules/analysis/hooks/queries';
import { dateColumn } from '@/shared/presentation/utilities/column-presets';
import { showPromise } from '@/shared/presentation/hooks/toast';
import useRetryFailedFrames from '@/modules/analysis/hooks/use-retry-failed-frames';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import { RiRefreshLine } from 'react-icons/ri';
import { useNavigate } from 'react-router-dom';
import './AnalysesListing.css';
import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';

const renderTrajectoryName: NonNullable<ColumnConfig['render']> = (_value, row) => {
    if (!row || typeof row !== 'object' || !('trajectory' in row)) {
        return '-';
    }

    const { trajectory } = row;
    if (!trajectory || typeof trajectory !== 'object' || !('name' in trajectory)) {
        return '-';
    }

    if (typeof trajectory.name !== 'string') {
        return '-';
    }

    return trajectory.name;
};

const renderTotalFrames: NonNullable<ColumnConfig['render']> = (value) => {
    if (typeof value !== 'number') {
        return '-';
    }

    return value.toLocaleString();
};

const getDeleteConfirmationMessage = (selectedItems: Analysis[]): string => {
    let message = 'Delete this analysis? This cannot be undone.';

    if (selectedItems.length !== 1) {
        message = `Delete ${selectedItems.length} analyses? This cannot be undone.`;
    }

    return message;
};

const COLUMNS: ColumnConfig<Analysis>[] = [
    {
        key: 'trajectory.name',
        title: 'Trajectory',
        sortable: true,
        render: renderTrajectoryName,
        skeleton: { variant: 'text', width: 140 }
    },
    {
        key: 'plugin',
        title: 'Plugin',
        sortable: true,
        render: String,
        skeleton: { variant: 'text', width: 110 }
    },
    {
        key: 'totalFrames',
        title: 'Total Frames',
        sortable: true,
        render: renderTotalFrames,
        skeleton: { variant: 'text', width: 90 }
    },
    dateColumn<Analysis>('startedAt', 'Started At', { sortable: false }),
    dateColumn<Analysis>('finishedAt', 'Finished At', { sortable: false }),
    dateColumn<Analysis>('createdAt', 'Created', { sortable: false })
];

const AnalysesListing = () => {
    const navigate = useNavigate();

    const deleteAnalysisMutation = analysisQuery.useDeleteMutation();
    const retryFailedFrames = useRetryFailedFrames();
    const fetchAnalysesData: (params: PaginationParams) => Promise<PaginatedResponse<Analysis>> = analysisQuery.useListQuery.fetch;

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
                confirm: ({ selectedItems }) => getDeleteConfirmationMessage(selectedItems),
                requiredPermission: 'analysis:delete'
            }
        }
    });

    return (
        <DocumentListing<Analysis>
            title='Analyses'
            queryKey={analysisQuery.QUERY_KEYS.all()}
            columns={COLUMNS}
            fetchData={fetchAnalysesData}
            defaultLimit={20}
            getMenuOptions={getMenuOptions}
            emptyMessage='No analyses found'
        />
    );
};

export default AnalysesListing;
