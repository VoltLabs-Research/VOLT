import { buttonVariants, cn } from '@heroui/react';
import ClusterQueueConcurrencyModal, {
    CLUSTER_QUEUE_CONCURRENCY_MODAL_ID
} from '@/modules/cluster/components/ClusterQueueConcurrencyModal';
import ClusterRoleModal, { CLUSTER_ROLE_MODAL_ID } from '@/modules/cluster/components/ClusterRoleModal';
import ClusterTransferModal, { CLUSTER_TRANSFER_MODAL_ID } from '@/modules/cluster/components/ClusterTransferModal';
import ClusterCredentialsModal, { CLUSTER_CREDENTIALS_MODAL_ID } from '@/modules/cluster/components/ClusterCredentialsModal';
import ClusterInstallCommandModal, { CLUSTER_INSTALL_COMMAND_MODAL_ID } from '@/modules/cluster/components/ClusterInstallCommandModal';
import { openModal } from '@/shared/ui/modal';
import ClusterStatusBadge from '@/modules/cluster/components/shared/ClusterStatusBadge';
import DeleteClusterModal, { DELETE_CLUSTER_MODAL_ID } from '@/modules/cluster/components/DeleteClusterModal';
import useClusterPageState from '@/modules/cluster/hooks/use-cluster-page-state';
import useClustersListingPage from '@/modules/cluster/hooks/use-clusters-listing-page';
import { useRegenerateTeamClusterEnrollmentTokenMutation, TEAM_CLUSTER_QUERY_KEYS, teamClusterListQueryKeys } from '@/modules/cluster/hooks/team-cluster/queries';
import { formatClusterTimestamp } from '@/modules/cluster/utils/format-cluster-timestamp';
import { getTeamClusterStatusLabel, getTeamClusterStatusVariant } from '@/modules/cluster/utils/team-cluster-status';
import {
    describeTeamClusterDraining,
    getTeamClusterRoleBadgeVariant,
    getTeamClusterRoleLabel,
    getTeamClusterRoleSummary,
    isTeamClusterRoleTransitionPending
} from '@/modules/cluster/utils/team-cluster-role';
import { TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';
import { isTeamClusterWaiting } from '@/modules/cluster/utils/is-team-cluster-waiting';
import { SOCKET_TEAM_CLUSTER_EVENTS } from '@/modules/socket/events/cluster';
import DocumentListing from '@/shared/ui/components/DocumentListing';
import { ArrowRightLeft, KeyRound, Monitor, Settings2, TerminalSquare, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { TeamCluster } from '@volt/contracts/modules/cluster/domain';
import type { SocketInvalidationConfig } from '@/shared/ui/components/DocumentListing';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';
import type { MenuOption } from '@/shared/contracts/menu';
import type { ServerRow } from '@/modules/cluster/utils/transform-cluster-row';
import { Link, useNavigate } from 'react-router-dom';

/**
 * `.server-table-bar` from the deleted ServerTable.css: a 4px×1.25rem segment whose
 * fill is the only thing that changes with the metric. bravais's `--radius-xs` is
 * 6px, which is HeroUI's `rounded-md` (spec §3b), and `--color-brand-primary` is the
 * accent. The sheet's `prefers-reduced-motion` `transition: none` is now global in
 * `index.css`.
 */
const METRIC_BAR_CLASS = 'w-[4px] h-5 rounded-md transition-colors duration-200 ease-out';

const METRIC_BAR_FILL_CLASS: Record<'active' | 'idle', string> = {
    active: 'bg-accent',
    idle: 'bg-border'
};

/**
 * `.clusters-empty-state`, which lived in ClusterMonitoringPage.css and was reached
 * from here by class name across a file that never imported it. See the note beside
 * the same literal in ClusterMonitoringPage for why it is duplicated rather than
 * shared.
 */
const EMPTY_STATE_CLASS = 'flex flex-col items-start gap-4 p-6 rounded-2xl border border-border bg-surface-secondary';

const renderMetricBars = (percentage: number, label: string): ReactNode => {
    const activeBars = Math.floor(percentage / 20);
    return (
        <div className='flex flex-row items-center gap-2'>
            <div className='flex gap-[0.1rem]'>
                {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className={cn(METRIC_BAR_CLASS, METRIC_BAR_FILL_CLASS[i < activeBars ? 'active' : 'idle'])} />
                ))}
            </div>
            <p className='text-xs text-muted'>{label}</p>
        </div>
    );
};

const renderMetricValue = (value: number | null): ReactNode => {
    return value === null
        ? <p className='text-xs text-muted'>--</p>
        : renderMetricBars(value, `${value}%`);
};

const renderDiskValue = (row: ServerRow): ReactNode => {
    if (row.diskUsagePercent === null || row.diskFree === null) {
        return <p className='text-xs text-muted'>--</p>;
    }

    return renderMetricBars(row.diskUsagePercent, `${row.diskFree.toFixed(1)}GB Available`);
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
        render: (_, row) => (
            <div className='flex flex-row items-center gap-2'>
                <p className='text-sm text-muted'>{row.name}</p>
            </div>
        )
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
                <div className='flex flex-col gap-1'>
                    <ClusterStatusBadge tone={getTeamClusterRoleBadgeVariant(row.desiredRole)}>
                        {getTeamClusterRoleLabel(row.desiredRole)}
                    </ClusterStatusBadge>
                    <p className={cn('text-xs', isTransitionPending ? 'text-warning' : 'text-muted')}>
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
        render: (_, row) => <p className='text-xs text-muted'>{formatClusterTimestamp(row.lastHeartbeatAt)}</p>
    }
];

const ClustersListing = () => {
    const navigate = useNavigate();
    const state = useClusterPageState();
    const vm = useClustersListingPage();
    const [installCommandClusterId, setInstallCommandClusterId] = useState<string | null>(null);
    const [installCommandToken, setInstallCommandToken] = useState<string | null>(null);
    const regenerateTokenMutation = useRegenerateTeamClusterEnrollmentTokenMutation();

    const handleRevealCredentials = (cluster: TeamCluster) => {
        state.setCredentialsCluster(cluster);
        openModal(CLUSTER_CREDENTIALS_MODAL_ID);
    };

    const handleDeleteCluster = (cluster: TeamCluster) => {
        state.setDeleteTarget(cluster);
        openModal(DELETE_CLUSTER_MODAL_ID);
    };

    const handleQueueConcurrency = (cluster: TeamCluster) => {
        state.setQueueConcurrencyTarget(cluster);
        openModal(CLUSTER_QUEUE_CONCURRENCY_MODAL_ID);
    };

    const handleRoleChange = (cluster: TeamCluster) => {
        state.setRoleTarget(cluster);
        openModal(CLUSTER_ROLE_MODAL_ID);
    };

    const handleTransferData = (cluster: TeamCluster) => {
        state.setTransferTarget(cluster);
        openModal(CLUSTER_TRANSFER_MODAL_ID);
    };

    const handleShowInstallCommand = (cluster: TeamCluster) => {
        if (!vm.selectedTeamId) return;

        regenerateTokenMutation.mutate({
            teamId: vm.selectedTeamId,
            teamClusterId: cluster._id
        }, {
            onSuccess: (data) => {
                setInstallCommandClusterId(cluster._id);
                setInstallCommandToken(data.enrollmentToken);
                openModal(CLUSTER_INSTALL_COMMAND_MODAL_ID);
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
            label: 'Reveal credentials',
            icon: KeyRound,
            onClick: () => handleRevealCredentials(row.teamCluster)
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
            <ClusterCredentialsModal
                teamCluster={state.credentialsCluster}
                credentials={state.credentials}
                onReveal={state.revealCredentials}
            />
            <DeleteClusterModal
                teamCluster={state.deleteTarget}
                onDelete={state.deleteCluster}
                onClose={() => state.setDeleteTarget(null)}
            />
            <ClusterQueueConcurrencyModal
                teamCluster={state.queueConcurrencyTarget}
                onSave={state.updateQueueConcurrency}
                onClose={() => state.setQueueConcurrencyTarget(null)}
            />
            <ClusterRoleModal
                teamCluster={state.roleTarget}
                onSave={state.updateRole}
                onClose={() => state.setRoleTarget(null)}
            />
            <ClusterTransferModal
                teamCluster={state.transferTarget}
                clusters={state.clusters}
                teamId={state.selectedTeamId}
                onSave={state.createTransferRequest}
                onClose={() => state.setTransferTarget(null)}
            />
            <ClusterInstallCommandModal
                clusterId={installCommandClusterId}
                enrollmentToken={installCommandToken}
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
                emptyMessage='No clusters found.'
                emptyIcon={(
                    <div className={EMPTY_STATE_CLASS}>
                        <h3 className='text-xl font-semibold text-foreground'>No clusters connected yet</h3>
                        <p className='text-sm text-muted'>
                            Create a team cluster to provision your first compute environment and unlock live metrics on this dashboard.
                        </p>
                        <Link
                            to='/onboarding/cluster/setup'
                            className={buttonVariants({ variant: 'primary' })}
                        >
                            Add New Cluster
                        </Link>
                    </div>
                )}
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
