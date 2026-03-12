import { analysisQuery } from '@/modules/analysis/hooks/queries';
import { dateColumn } from '@/shared/presentation/utilities/column-presets';
import { showPromise } from '@/shared/presentation/hooks/toast';
import useRetryFailedFrames from '@/modules/analysis/hooks/use-retry-failed-frames';
import AnalysisConfigPreview from '@/modules/analysis/components/atoms/AnalysisConfigPreview';
import ListingUserCell from '@/shared/presentation/components/ListingUserCell';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import { RiRefreshLine } from 'react-icons/ri';
import { useNavigate } from 'react-router-dom';
import './AnalysesListing.css';
import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';

const renderTrajectoryName: NonNullable<ColumnConfig<Analysis>['render']> = (_value, row) => {
    return row.trajectory?.name || '-';
};

const renderPluginName: NonNullable<ColumnConfig<Analysis>['render']> = (_value, row) => {
    return row.pluginDisplayName || row.plugin || '-';
};

const renderCluster: NonNullable<ColumnConfig<Analysis>['render']> = (_value, row) => {
    if (!row.teamCluster) {
        return <span className='font-size-2 color-muted'>-</span>;
    }

    if (typeof row.teamCluster === 'string') {
        return <span className='font-size-2 color-secondary'>{row.teamCluster}</span>;
    }

    return <span className='font-size-2 color-secondary'>{row.teamCluster.name || row.teamCluster._id}</span>;
};

const renderFrameCount: NonNullable<ColumnConfig<Analysis>['render']> = (value) => {
    if (typeof value !== 'number') {
        return '-';
    }

    return value.toLocaleString();
};

const renderCreatedBy: NonNullable<ColumnConfig<Analysis>['render']> = (_value, row) => {
    const user = typeof row.createdBy === 'string'
        ? null
        : row.createdBy;
    return <ListingUserCell user={user} />;
};

const renderConfig: NonNullable<ColumnConfig<Analysis>['render']> = (_value, row) => {
    return <AnalysisConfigPreview analysis={row} />;
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
        key: 'pluginDisplayName',
        title: 'Plugin',
        sortable: true,
        render: renderPluginName,
        skeleton: { variant: 'text', width: 110 }
    },
    {
        key: 'teamCluster',
        title: 'Cluster',
        sortable: false,
        render: renderCluster,
        skeleton: { variant: 'text', width: 140 }
    },
    {
        key: 'status',
        title: 'Status',
        sortable: true,
        render: (value) => <StatusBadge status={String(value)} />,
        skeleton: { variant: 'rounded', width: 90, height: 24 }
    },
    {
        key: 'totalFrames',
        title: 'Total Frames',
        sortable: true,
        render: renderFrameCount,
        skeleton: { variant: 'text', width: 90 }
    },
    {
        key: 'completedFrames',
        title: 'Completed Frames',
        sortable: true,
        render: renderFrameCount,
        skeleton: { variant: 'text', width: 110 }
    },
    {
        key: 'config',
        title: 'Config',
        sortable: false,
        render: renderConfig,
        skeleton: { variant: 'text', width: 110 }
    },
    {
        key: 'createdBy',
        title: 'Created By',
        sortable: false,
        render: renderCreatedBy,
        skeleton: { variant: 'text', width: 180 }
    },
    dateColumn<Analysis>('startedAt', 'Started At', { sortable: false, withTitle: true, fallback: '-' }),
    dateColumn<Analysis>('finishedAt', 'Finished At', { sortable: false, withTitle: true, fallback: '-' }),
    dateColumn<Analysis>('createdAt', 'Created At', { sortable: false, withTitle: true })
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
            title='Analysis Configs'
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
