import { analysisQuery } from '@/modules/analysis/hooks/queries';
import { clusterColumn, dateColumn, userColumn } from '@/shared/presentation/utilities/column-presets';
import { showPromise } from '@/shared/presentation/hooks/toast';
import useRetryFailedFrames from '@/modules/analysis/hooks/use-retry-failed-frames';
import AnalysisConfigPreview from '@/modules/analysis/components/atoms/AnalysisConfigPreview';
import PopulatedCellPopover from '@/shared/presentation/components/PopulatedCellPopover';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import { RiRefreshLine } from 'react-icons/ri';
import { FlaskConical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './AnalysesListing.css';
import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';

const renderTrajectoryName: NonNullable<ColumnConfig<Analysis>['render']> = (_value, row) => {
    const trajectory = row.trajectory as unknown as Record<string, unknown> | null;
    return (
        <PopulatedCellPopover document={trajectory} modelName='Trajectory'>
            <span>{row.trajectory?.name || '-'}</span>
        </PopulatedCellPopover>
    );
};

const renderPluginName: NonNullable<ColumnConfig<Analysis>['render']> = (_value, row) => {
    return row.pluginDisplayName || row.plugin || '-';
};

const renderFrameCount: NonNullable<ColumnConfig<Analysis>['render']> = (value) => {
    if (typeof value !== 'number') {
        return '-';
    }

    return value.toLocaleString();
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
    clusterColumn<Analysis>(),
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
    userColumn<Analysis>('createdBy', 'Created By'),
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
            emptyMessage='Run an analysis on a processed trajectory to review configuration, progress, and results here.'
            emptyTitle='No analyses yet'
            emptyIcon={<FlaskConical size={28} strokeWidth={1.6} />}
            emptyButtonText='Open trajectories'
            onEmptyButtonClick={() => navigate('/dashboard/trajectories/list')}
            socketInvalidation={[
                { event: 'analysis.created', queryKeys: [analysisQuery.QUERY_KEYS.all()] },
                { event: 'analysis.updated', queryKeys: [analysisQuery.QUERY_KEYS.all()] },
                { event: 'analysis.deleted', queryKeys: [analysisQuery.QUERY_KEYS.all()] }
            ]}
        />
    );
};

export default AnalysesListing;
