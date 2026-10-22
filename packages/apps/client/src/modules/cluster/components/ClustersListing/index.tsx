import { CLUSTER_INSTALL_COMMAND_MODAL_ID, CLUSTER_QUEUE_CONCURRENCY_MODAL_ID, CLUSTER_ROLE_MODAL_ID, CLUSTER_TRANSFER_MODAL_ID, DELETE_CLUSTER_MODAL_ID } from '@/modules/cluster/contracts/modal-ids';
import { Chip, cn } from '@heroui/react';
import ClusterQueueConcurrencyModal from '@/modules/cluster/components/ClusterQueueConcurrencyModal';
import ClusterRoleModal from '@/modules/cluster/components/ClusterRoleModal';
import ClusterTransferModal from '@/modules/cluster/components/ClusterTransferModal';
import ClusterInstallCommandModal from '@/modules/cluster/components/ClusterInstallCommandModal';
import type { ClusterInstallCommand } from '@/modules/cluster/components/ClusterInstallCommandModal';
import { openModal, useModalPayload } from '@/shared/ui/modal/use-modal-store';
import ClusterStatusBadge from '@/modules/cluster/components/shared/ClusterStatusBadge';
import DeleteClusterModal from '@/modules/cluster/components/DeleteClusterModal';
import useClusterPageState from '@/modules/cluster/hooks/use-cluster-page-state';
import useClustersListingPage from './use-clusters-listing-page';
import { useRegenerateTeamClusterEnrollmentTokenMutation, TEAM_CLUSTER_QUERY_KEYS, teamClusterListQueryKeys } from '@/modules/cluster/hooks/team-cluster/queries';
import { formatClusterTimestamp } from '@/modules/cluster/utils/format-cluster-timestamp';
import { getTeamClusterStatusLabel, getTeamClusterStatusVariant } from '@/modules/cluster/utils/team-cluster-status';
import {
    describeTeamClusterDraining,
    getTeamClusterRoleLabel,
    getTeamClusterRoleSummary,
    isTeamClusterRoleTransitionPending
} from '@/modules/cluster/utils/team-cluster-role';
import { TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';
import { isTeamClusterWaiting } from '@/modules/cluster/utils/is-team-cluster-waiting';
import { SOCKET_TEAM_CLUSTER_EVENTS } from '@/modules/socket/events/cluster';
import DocumentListing from '@/shared/ui/components/DocumentListing';
import { ArrowRightLeft, Monitor, Settings2, TerminalSquare, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { TeamCluster } from '@volt/contracts/modules/cluster/domain';
import type { SocketInvalidationConfig } from '@/shared/ui/components/DocumentListing';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';
import type { MenuOption } from '@/shared/contracts/menu';
import type { ServerRow } from '@/modules/cluster/utils/transform-cluster-row';
import { useNavigate } from 'react-router-dom';

const METER_BAR_HEIGHTS = ['h-[30%]', 'h-[47%]', 'h-[64%]', 'h-[82%]', 'h-full'];

// Five rising bars, lit up to the share in use; the lit ones warn from 60% and turn red from 80%.
const renderMetricBars = (percentage: number, label: string): ReactNode => {
    const activeBars = Math.max(1, Math.round(percentage / 20));
    const activeTone = percentage >= 80 ? 'bg-danger' : percentage >= 60 ? 'bg-warning' : 'bg-foreground';

    return (
        <div className='flex flex-row items-center gap-2'>
            <div className='flex h-3.5 items-end gap-0.5' aria-hidden='true'>
                {METER_BAR_HEIGHTS.map((height, i) => (
                    <div key={height} className={cn('w-[3px] rounded-sm', height, i < activeBars ? activeTone : 'bg-foreground/15')} />
                ))}
            </div>
            <span className='tabular-nums text-foreground'>{label}</span>
        </div>
    );
};

const renderMetricValue = (value: number | null): ReactNode => {
    return value === null
        ? <span className='text-muted'>—</span>
        : renderMetricBars(value, `${value}%`);
};

const renderDiskValue = (row: ServerRow): ReactNode => {
    if (row.diskUsagePercent === null || row.diskFree === null) {
        return <span className='text-muted'>—</span>;
    }

    return renderMetricBars(row.diskUsagePercent, `${row.diskFree.toFixed(1)} GB Available`);
};

const createMetricColumn = (key: 'cpu' | 'memory', title: string): ColumnConfig<ServerRow> => ({
    key,
    title,
    sortable: true,
    width: 180,
    render: (_, row) => renderMetricValue(row[key])
});

const CLUSTER_COLUMNS: ColumnConfig<ServerRow>[] = [
    {
        key: 'name',
        title: 'Cluster',
        sortable: true,
        width: 240,
        render: (_, row) => <span className='font-medium text-foreground'>{row.name}</span>
    },
    {
        key: 'lifecycleStatus',
        title: 'Lifecycle',
        sortable: true,
        width: 180,
        render: (_, row) => (
            <ClusterStatusBadge tone={getTeamClusterStatusVariant(row.lifecycleStatus)}>
                {getTeamClusterStatusLabel(row.lifecycleStatus)}
            </ClusterStatusBadge>
        )
    },
    {
        key: 'desiredRole',
        title: 'Role',
        sortable: true,
        width: 220,
        render: (_, row) => {
            const isTransitionPending = isTeamClusterRoleTransitionPending(row.teamCluster);
            const drainingSummary = describeTeamClusterDraining(row.teamCluster);

            return (
                <div className='flex flex-row flex-wrap items-center gap-x-2 gap-y-1'>
                    <Chip color='default' variant='soft' size='sm'>
                        <Chip.Label>{getTeamClusterRoleLabel(row.desiredRole)}</Chip.Label>
                    </Chip>
                    <p className={cn('text-xs', isTransitionPending ? 'text-warning-soft-foreground' : 'text-muted')}>
                        {isTransitionPending
                            ? `${drainingSummary ? `${drainingSummary}, ` : ''}effective ${getTeamClusterRoleLabel(row.effectiveRole)}`
                            : getTeamClusterRoleSummary(row.desiredRole)}
                    </p>
                </div>
            );
        }
    },
    {
        key: 'status',
        title: 'Metrics',
        sortable: true,
        width: 220,
        render: (_, row) => (
            <ClusterStatusBadge tone={row.statusVariant}>
                {row.status}
            </ClusterStatusBadge>
        )
    },
    createMetricColumn('cpu', 'CPU'),
    createMetricColumn('memory', 'Memory'),
    {
        key: 'diskUsagePercent',
        title: 'Disk',
        sortable: true,
        width: 220,
        render: (_, row) => renderDiskValue(row)
    },
    {
        key: 'lastHeartbeatAt',
        title: 'Last Heartbeat',
        sortable: true,
        width: 180,
        render: (_, row) => <span className='text-muted'>{formatClusterTimestamp(row.lastHeartbeatAt)}</span>
    }
];

const ClustersListing = () => {
    const navigate = useNavigate();
    const state = useClusterPageState();
    const vm = useClustersListingPage();
    const installCommand = useModalPayload<ClusterInstallCommand>(CLUSTER_INSTALL_COMMAND_MODAL_ID);
    const regenerateTokenMutation = useRegenerateTeamClusterEnrollmentTokenMutation();

    const handleDeleteCluster = (cluster: TeamCluster) => {
        openModal(DELETE_CLUSTER_MODAL_ID, cluster);
    };

    const handleQueueConcurrency = (cluster: TeamCluster) => {
        openModal(CLUSTER_QUEUE_CONCURRENCY_MODAL_ID, cluster);
    };

    const handleRoleChange = (cluster: TeamCluster) => {
        openModal(CLUSTER_ROLE_MODAL_ID, cluster);
    };

    const handleTransferData = (cluster: TeamCluster) => {
        openModal(CLUSTER_TRANSFER_MODAL_ID, cluster);
    };

    const handleShowInstallCommand = (cluster: TeamCluster) => {
        if (!vm.selectedTeamId) return;

        regenerateTokenMutation.mutate({
            teamId: vm.selectedTeamId,
            teamClusterId: cluster._id
        }, {
            onSuccess: (data) => {
                openModal<ClusterInstallCommand>(CLUSTER_INSTALL_COMMAND_MODAL_ID, {
                    clusterId: cluster._id,
                    enrollmentToken: data.enrollmentToken
                });
            }
        });
    };

    const socketInvalidation = useMemo<SocketInvalidationConfig[] | undefined>(() => {
        if (!vm.selectedTeamId) {
            return undefined;
        }

        return [
            {
                event: SOCKET_TEAM_CLUSTER_EVENTS.LIFECYCLE_UPDATED,
                queryKeys: teamClusterListQueryKeys(vm.selectedTeamId)
            }
        ];
    }, [vm.selectedTeamId]);

    const getMenuOptions = (row: ServerRow): MenuOption[] => [
        {
            label: 'Monitor',
            icon: Monitor,
            onClick: () => navigate(`/dashboard/clusters/${row.id}`)
        },
        {
            label: 'Show install command',
            icon: TerminalSquare,
            disabled: !isTeamClusterWaiting(row.teamCluster.status),
            onClick: () => handleShowInstallCommand(row.teamCluster)
        },
        {
            label: 'Edit queue concurrency',
            icon: Settings2,
            onClick: () => handleQueueConcurrency(row.teamCluster)
        },
        {
            label: 'Change runtime role',
            icon: Settings2,
            onClick: () => handleRoleChange(row.teamCluster)
        },
        {
            label: 'Transfer storage + listing state',
            icon: ArrowRightLeft,
            disabled: row.teamCluster.status !== TeamClusterStatus.Connected || !row.teamCluster.effectiveCapabilities.servesStorageReads,
            onClick: () => handleTransferData(row.teamCluster)
        },
        {
            label: 'Delete cluster',
            icon: Trash2,
            destructive: true,
            onClick: () => handleDeleteCluster(row.teamCluster)
        }
    ];

    return (
        <>
            <DeleteClusterModal
                teamCluster={state.deleteTarget}
                onDelete={state.deleteCluster}
            />
            <ClusterQueueConcurrencyModal
                teamCluster={state.queueConcurrencyTarget}
                onSave={state.updateQueueConcurrency}
            />
            <ClusterRoleModal
                teamCluster={state.roleTarget}
                onSave={state.updateRole}
            />
            <ClusterTransferModal
                teamCluster={state.transferTarget}
                clusters={state.clusters}
                teamId={state.selectedTeamId}
                onSave={state.createTransferRequest}
            />
            <ClusterInstallCommandModal
                clusterId={installCommand?.clusterId ?? null}
                enrollmentToken={installCommand?.enrollmentToken ?? null}
            />
            <DocumentListing<ServerRow>
                title='Clusters'
                queryKey={TEAM_CLUSTER_QUERY_KEYS.listingByTeam(vm.selectedTeamId ?? '')}
                columns={CLUSTER_COLUMNS}
                fetchData={vm.fetchClusters}
                getMenuOptions={getMenuOptions}
                onItemClick={(row) => {
                    navigate(`/dashboard/clusters/${row.id}`);
                    return true;
                }}
                defaultLimit={20}
                emptyMessage='Create a team cluster to provision your first compute environment and unlock live metrics on this dashboard.'
                emptyButtonText='Add New Cluster'
                onEmptyButtonClick={() => navigate('/onboarding/cluster/setup')}
                createNew={{
                    buttonTitle: 'Add new Cluster',
                    onCreate: () => navigate('/onboarding/cluster/setup')
                }}
                hideTabs
                enabled={Boolean(vm.selectedTeamId)}
                socketInvalidation={socketInvalidation}
            />
        </>
    );
};

export default ClustersListing;
