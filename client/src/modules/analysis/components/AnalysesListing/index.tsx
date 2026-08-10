import { analysisQuery } from '@/modules/analysis/hooks/queries';
import { SOCKET_ANALYSIS_EVENTS } from '@/modules/socket/events/analysis';
import { SOCKET_TEAM_EVENTS } from '@/modules/socket/events/team';
import { dateColumn, userColumn } from '@/shared/ui/utils/column-presets';
import { showPromise } from '@/shared/ui/hooks/toast';
import useRetryFailedFrames from '@/modules/analysis/hooks/use-retry-failed-frames';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { getListingRelevantExposures } from '@/modules/plugin/utils/listing/listing-exposures';
import { AnalysisStatus } from '@/modules/fractal/contracts';
import { resolveAnalysisPluginId } from '@/modules/analysis/utils/resolve-plugin-id';
import PopulatedCellPopover from '@/shared/ui/components/PopulatedCellPopover';
import { Button, cn } from '@heroui/react';
import useListingActions from '@/shared/ui/hooks/use-listing-actions';
import DocumentListing from '@/shared/ui/components/DocumentListing';
import { useMemo } from 'react';
import { ExternalLink, FlaskConical, RefreshCw } from 'lucide-react';
import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';
import type { PaginationParams } from '@/shared/ui/hooks/use-pagination-params';
import { useNavigate } from 'react-router-dom';

const STATUS_TONE_CLASS_NAMES: Record<string, string> = {
    ready: 'text-success',
    completed: 'text-success',
    success: 'text-success',
    active: 'text-success',
    published: 'text-success',
    healthy: 'text-success',
    online: 'text-success',
    accepted: 'text-success',
    connected: 'text-success',

    processing: 'text-warning',
    queued: 'text-warning',
    rendering: 'text-warning',
    warning: 'text-warning',
    pending: 'text-warning',
    'waiting-for-process': 'text-warning',
    analyzing: 'text-warning',

    running: 'text-accent',
    brand: 'text-accent',

    failed: 'text-danger',
    error: 'text-danger',
    danger: 'text-danger',
    critical: 'text-danger',
    rejected: 'text-danger',

    inactive: 'text-muted',
    draft: 'text-muted',
    disabled: 'text-muted',
    offline: 'text-muted',
    disconnected: 'text-muted',

    primary: 'text-foreground'
};

const STATUS_BASE_CLASS_NAMES = 'inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium uppercase';

const renderStatus: NonNullable<ColumnConfig<Analysis>['render']> = (value) => {
    const status = String(value);

    return (
        <span className={cn(STATUS_BASE_CLASS_NAMES, STATUS_TONE_CLASS_NAMES[status.toLowerCase()] ?? 'text-muted')}>
            {status}
        </span>
    );
};

const renderTrajectoryName: NonNullable<ColumnConfig<Analysis>['render']> = (_value, row) => {
    return (
        <PopulatedCellPopover document={row.trajectory} modelName='Trajectory'>
            <span>{row.trajectory?.name || '-'}</span>
        </PopulatedCellPopover>
    );
};

const getDeleteConfirmationMessage = (selectedItems: Analysis[]): string => {
    let message = 'Delete this analysis? This cannot be undone.';

    if (selectedItems.length !== 1) {
        message = `Delete ${selectedItems.length} analyses? This cannot be undone.`;
    }

    return message;
};

const resolveAnalysisListingPath = (analysis: Analysis, plugin: Plugin | undefined): string | undefined => {
    if (analysis.status !== AnalysisStatus.Completed) {
        return undefined;
    }

    const trajectoryId = analysis.trajectory?._id;
    const pluginId = resolveAnalysisPluginId(analysis);
    if (!trajectoryId || !pluginId) {
        return undefined;
    }

    const listingExposures = getListingRelevantExposures(plugin?.exposures);
    if (listingExposures.length === 0) {
        return undefined;
    }

    const primaryExposureId = analysis.expectedArtifacts?.find((artifact) => artifact.isPrimary)?.exposureId;
    const exposureId = (primaryExposureId && listingExposures.some((exposure) => exposure.exposureId === primaryExposureId))
        ? primaryExposureId
        : listingExposures[0].exposureId;

    return `/dashboard/trajectory/${trajectoryId}/plugins/${pluginId}/exposure/${exposureId}/listing`;
};

const BASE_COLUMNS: ColumnConfig<Analysis>[] = [
    {
        key: 'trajectory.name',
        title: 'Trajectory',
        sortable: true,
        render: renderTrajectoryName,
        skeleton: {
            variant: 'text',
            width: 140
        }
    },
    {
        key: 'pluginDisplayName',
        title: 'Plugin',
        sortable: true,
        skeleton: {
            variant: 'text',
            width: 110
        }
    },
    {
        key: 'status',
        title: 'Status',
        sortable: true,
        render: renderStatus,
        skeleton: {
            variant: 'rounded',
            width: 90,
            height: 24
        }
    },
    userColumn<Analysis>('createdBy', 'Created By'),
    dateColumn<Analysis>('finishedAt', 'Finished At', {
        sortable: false,
        withTitle: true,
        fallback: '-'
    })
];

const AnalysesListing = () => {
    const navigate = useNavigate();

    const deleteAnalysisMutation = analysisQuery.useDeleteMutation();
    const retryFailedFrames = useRetryFailedFrames();
    const { pluginsById } = usePluginSelectors();
    const fetchAnalysesData: (params: PaginationParams) => Promise<PaginatedResponse<Analysis>> = analysisQuery.useListQuery.fetch;

    const columns = useMemo<ColumnConfig<Analysis>[]>(() => [
        ...BASE_COLUMNS,
        {
            key: 'results',
            title: 'Results',
            sortable: false,
            width: 140,
            render: (_value, analysis) => {
                const listingPath = resolveAnalysisListingPath(analysis, pluginsById[resolveAnalysisPluginId(analysis)]);
                if (!listingPath) {
                    return '-';
                }

                return (
                    <Button
                        variant='ghost'
                        size='sm'
                        onPress={() => { navigate(listingPath); }}
                    >
                        <ExternalLink size={14} />
                        View results
                    </Button>
                );
            },
            skeleton: {
                variant: 'rounded',
                width: 110,
                height: 28
            }
        }
    ], [pluginsById, navigate]);

    const { getMenuOptions } = useListingActions<Analysis>({
        actions: {
            view: {
                label: 'View Scene',
                handler: ({ item: analysis }) => {
                    navigate(`/canvas/${analysis.trajectory._id}?analysisId=${encodeURIComponent(analysis._id)}`);
                },
                requiredPermission: 'analysis:read'
            },
            retry: {
                label: 'Retry Failed Frames',
                icon: RefreshCw,
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
            queryKey={analysisQuery.QUERY_KEYS.lists()}
            columns={columns}
            fetchData={fetchAnalysesData}
            defaultLimit={20}
            getMenuOptions={getMenuOptions}
            onItemClick={(analysis) => {
                navigate(`/canvas/${analysis.trajectory._id}?analysisId=${encodeURIComponent(analysis._id)}`);
                return true;
            }}
            emptyMessage='Run an analysis on a processed trajectory to review configuration, progress, and results here.'
            emptyTitle='No analyses yet'
            emptyIcon={<FlaskConical size={28} strokeWidth={1.6} />}
            emptyButtonText='Open trajectories'
            onEmptyButtonClick={() => navigate('/dashboard/trajectories/list')}
            socketInvalidation={[
                {
                    event: SOCKET_ANALYSIS_EVENTS.CREATED,
                    queryKeys: [analysisQuery.QUERY_KEYS.lists()]
                },
                {
                    event: SOCKET_ANALYSIS_EVENTS.STATUS_CHANGED,
                    queryKeys: [analysisQuery.QUERY_KEYS.lists()]
                },
                {
                    event: SOCKET_TEAM_EVENTS.JOB_UPDATED,
                    queryKeys: [analysisQuery.QUERY_KEYS.lists()]
                },
                {
                    event: SOCKET_ANALYSIS_EVENTS.DELETED,
                    queryKeys: [analysisQuery.QUERY_KEYS.lists()]
                }
            ]}
        />
    );
};

export default AnalysesListing;
