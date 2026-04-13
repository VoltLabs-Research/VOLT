import ClusterQueueConcurrencyModal, {
    CLUSTER_QUEUE_CONCURRENCY_MODAL_ID
} from '@/modules/cluster/components/organisms/ClusterQueueConcurrencyModal';
import ClusterRoleModal, { CLUSTER_ROLE_MODAL_ID } from '@/modules/cluster/components/organisms/ClusterRoleModal';
import ClusterTransferModal, { CLUSTER_TRANSFER_MODAL_ID } from '@/modules/cluster/components/organisms/ClusterTransferModal';
import ClusterCredentialsModal, { CLUSTER_CREDENTIALS_MODAL_ID } from '@/modules/cluster/components/organisms/ClusterCredentialsModal';
import ClusterInstallCommandModal, { CLUSTER_INSTALL_COMMAND_MODAL_ID } from '@/modules/cluster/components/organisms/ClusterInstallCommandModal';
import ClustersEmptyState from '@/modules/cluster/components/organisms/ClustersEmptyState';
import DeleteClusterModal, { DELETE_CLUSTER_MODAL_ID } from '@/modules/cluster/components/organisms/DeleteClusterModal';
import useClusterPageState from '@/modules/cluster/hooks/use-cluster-page-state';
import useClustersListingPage from '@/modules/cluster/hooks/use-clusters-listing-page';
import { useRegenerateTeamClusterEnrollmentTokenMutation, TEAM_CLUSTER_QUERY_KEYS } from '@/modules/cluster/hooks/team-cluster/queries';
import { formatClusterTimestamp } from '@/modules/cluster/utilities/format-cluster-timestamp';
import { getTeamClusterStatusLabel, getTeamClusterStatusVariant } from '@/modules/cluster/utilities/team-cluster-status';
import {
    describeTeamClusterDraining,
    getTeamClusterRoleBadgeVariant,
    getTeamClusterRoleLabel,
    getTeamClusterRoleSummary,
    isTeamClusterRoleTransitionPending
} from '@/modules/cluster/utilities/team-cluster-role';
import {
    getClusterTransferDirectionLabel as getTransferDirectionLabel,
    getClusterTransferJobStateBadgeVariant as getTransferStateBadgeVariant,
    getClusterTransferJobStateLabel as getTransferStateLabel,
    getClusterTransferJobSummaryLabel as getTransferSummaryLabel
} from '@/modules/cluster/utilities/team-cluster-transfer';
import { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';
import { isTeamClusterWaiting } from '@/modules/cluster/utilities/is-team-cluster-waiting';
import { TEAM_CLUSTER_SOCKET_EVENTS } from '@/modules/cluster/api/service/endpoints/team-cluster-socket-events';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import MetricBars from '@/modules/cluster/components/organisms/MetricBars';
import Paragraph from '@/shared/presentation/components/Paragraph';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import Container from '@/shared/presentation/components/Container';
import { openModal } from '@/shared/presentation/components/Modal';
import { ArrowRightLeft, Database, FolderOpen, KeyRound, Monitor, Settings2, TerminalSquare, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';
import type { ColumnConfig, MenuOption, SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import type { ServerRow } from '@/modules/cluster/utilities/transform-cluster-row';
import '@/modules/cluster/components/organisms/ServerTable/ServerTable.css';

const ACTIVE_TRANSFER_PREVIEW_LIMIT = 3;

const renderMetricValue = (value: number | null): ReactNode => {
    if (value === null) {
        return <Paragraph className='font-size-1 color-muted'>--</Paragraph>;
    }

    return (
        <Container className='d-flex items-center gap-05'>
            <MetricBars percentage={value} />
            <Paragraph className='font-size-1 color-muted'>{value}%</Paragraph>
        </Container>
    );
};

const renderDiskValue = (row: ServerRow): ReactNode => {
    if (row.diskUsagePercent === null || row.diskFree === null) {
        return <Paragraph className='font-size-1 color-muted'>--</Paragraph>;
    }

    return (
        <Container className='d-flex items-center gap-05'>
            <MetricBars percentage={row.diskUsagePercent} />
            <Paragraph className='font-size-1 color-muted'>{row.diskFree.toFixed(1)}GB Available</Paragraph>
        </Container>
    );
};

const ClustersListing = () => {
    const navigate = useNavigate();
    const state = useClusterPageState();
    const vm = useClustersListingPage();
    const [installCommandClusterId, setInstallCommandClusterId] = useState<string | null>(null);
    const [installCommandToken, setInstallCommandToken] = useState<string | null>(null);
    const regenerateTokenMutation = useRegenerateTeamClusterEnrollmentTokenMutation();
    const createNew = useMemo(() => {
        return {
            buttonTitle: 'Add new Cluster',
            onCreate: () => navigate('/onboarding/cluster/setup')
        };
    }, [navigate]);

    const handleRevealCredentials = useCallback((cluster: TeamCluster) => {
        state.setCredentialsCluster(cluster);
        openModal(CLUSTER_CREDENTIALS_MODAL_ID);
    }, [state]);

    const handleDeleteCluster = useCallback((cluster: TeamCluster) => {
        state.setDeleteTarget(cluster);
        openModal(DELETE_CLUSTER_MODAL_ID);
    }, [state]);

    const handleQueueConcurrency = useCallback((cluster: TeamCluster) => {
        state.setQueueConcurrencyTarget(cluster);
        openModal(CLUSTER_QUEUE_CONCURRENCY_MODAL_ID);
    }, [state]);

    const handleRoleChange = useCallback((cluster: TeamCluster) => {
        state.setRoleTarget(cluster);
        openModal(CLUSTER_ROLE_MODAL_ID);
    }, [state]);

    const handleTransferData = useCallback((cluster: TeamCluster) => {
        state.setTransferTarget(cluster);
        openModal(CLUSTER_TRANSFER_MODAL_ID);
    }, [state]);

    const handleShowInstallCommand = useCallback((cluster: TeamCluster) => {
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
    }, [vm.selectedTeamId, regenerateTokenMutation]);

    const socketInvalidation = useMemo<SocketInvalidationConfig[] | undefined>(() => {
        if (!vm.selectedTeamId) {
            return undefined;
        }

        return [
            {
                event: TEAM_CLUSTER_SOCKET_EVENTS.lifecycleUpdated,
                queryKeys: [TEAM_CLUSTER_QUERY_KEYS.byTeam(vm.selectedTeamId)]
            }
        ];
    }, [vm.selectedTeamId]);

    const clusterNameById = useMemo(() => {
        return new Map(state.clusters.map((cluster) => [cluster._id, cluster.name]));
    }, [state.clusters]);

    const columns = useMemo<ColumnConfig<ServerRow>[]>(() => [
        {
            key: 'name',
            title: 'Cluster',
            sortable: true,
            width: 240,
            render: (_, row) => (
                <Container className='d-flex items-center gap-05'>
                    <Paragraph className='font-size-2 color-secondary'>{row.name}</Paragraph>
                </Container>
            )
        },
        {
            key: 'lifecycleStatus',
            title: 'Lifecycle',
            sortable: true,
            width: 180,
            render: (_, row) => (
                <StatusBadge variant={getTeamClusterStatusVariant(row.lifecycleStatus)} size='compact'>
                    {getTeamClusterStatusLabel(row.lifecycleStatus)}
                </StatusBadge>
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
                    <Container className='d-flex column gap-025'>
                        <StatusBadge variant={getTeamClusterRoleBadgeVariant(row.desiredRole)} size='compact'>
                            {getTeamClusterRoleLabel(row.desiredRole)}
                        </StatusBadge>
                        <Paragraph className={`font-size-1 ${isTransitionPending ? 'color-warning' : 'color-muted'}`}>
                            {isTransitionPending
                                ? `${drainingSummary ? `${drainingSummary}, ` : ''}effective ${getTeamClusterRoleLabel(row.effectiveRole)}`
                                : getTeamClusterRoleSummary(row.desiredRole)}
                        </Paragraph>
                    </Container>
                );
            }
        },
        {
            key: 'status',
            title: 'Metrics',
            sortable: true,
            width: 220,
            render: (_, row) => (
                <StatusBadge variant={row.statusVariant} size='compact'>
                    {row.status}
                </StatusBadge>
            )
        },
        {
            key: 'installedVersion',
            title: 'Version',
            sortable: true,
            width: 140,
            render: (_, row) => <Paragraph className='font-size-2 color-secondary'>{row.installedVersion ?? '--'}</Paragraph>
        },
        {
            key: 'activeTransfers',
            title: 'Active Transfers',
            headerTitleClassName: 'font-weight-4',
            width: 340,
            render: (_, row) => {
                if (row.activeTransfers.length === 0) {
                    return <Paragraph className='font-size-1 color-muted'>--</Paragraph>;
                }

                const visibleTransfers = row.activeTransfers.slice(0, ACTIVE_TRANSFER_PREVIEW_LIMIT);
                const remainingTransfers = row.activeTransfers.length - visibleTransfers.length;

                return (
                    <Container className='d-flex column gap-05'>
                        {visibleTransfers.map((job) => {
                            const peerClusterId = job.sourceClusterId === row.id
                                ? job.destinationClusterId
                                : job.sourceClusterId;
                            const peerClusterName = clusterNameById.get(peerClusterId) ?? peerClusterId;

                            return (
                                <Container key={job._id} className='d-flex column gap-025'>
                                    <Container className='d-flex items-center gap-05 flex-wrap'>
                                        <StatusBadge variant={getTransferStateBadgeVariant(job.state)} size='compact'>
                                            {getTransferStateLabel(job.state)}
                                        </StatusBadge>
                                        <Paragraph className='font-size-1 color-secondary'>
                                            {getTransferSummaryLabel(job)}
                                        </Paragraph>
                                    </Container>
                                    <Paragraph className='font-size-1 color-muted'>
                                        {getTransferDirectionLabel(job, row.id)} · {peerClusterName}
                                    </Paragraph>
                                </Container>
                            );
                        })}
                        {remainingTransfers > 0 && (
                            <Paragraph className='font-size-1 color-muted'>+{remainingTransfers} more</Paragraph>
                        )}
                    </Container>
                );
            }
        },
        {
            key: 'lastHeartbeatAt',
            title: 'Last Heartbeat',
            sortable: true,
            width: 180,
            render: (_, row) => <Paragraph className='font-size-1 color-secondary'>{formatClusterTimestamp(row.lastHeartbeatAt)}</Paragraph>
        },
        {
            key: 'daemonPort',
            title: 'Daemon Port',
            sortable: true,
            width: 140,
            render: (_, row) => <Paragraph className='font-size-2 color-secondary font-family-mono'>{row.daemonPort ?? '--'}</Paragraph>
        },
        {
            key: 'cpu',
            title: 'CPU',
            sortable: true,
            width: 180,
            render: (_, row) => renderMetricValue(row.cpu)
        },
        {
            key: 'memory',
            title: 'Memory',
            sortable: true,
            width: 180,
            render: (_, row) => renderMetricValue(row.memory)
        },
        {
            key: 'diskUsagePercent',
            title: 'Disk',
            sortable: true,
            width: 220,
            render: (_, row) => renderDiskValue(row)
        },
        {
            key: 'network',
            title: 'Network',
            sortable: true,
            width: 180
        },
        {
            key: 'analysisCount',
            title: 'Computed Analyzes',
            sortable: true,
            width: 180,
            render: (_, row) => <Paragraph className='font-size-2 color-secondary'>{row.analysisCount ?? '--'}</Paragraph>
        },
        {
            key: 'uptime',
            title: 'Uptime',
            sortable: true,
            width: 140,
            render: (_, row) => <Paragraph className='font-size-2 font-weight-5 color-secondary'>{row.uptime}</Paragraph>
        }
    ], [clusterNameById]);

    const getMenuOptions = useCallback((row: ServerRow): MenuOption[] => [
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
            label: 'Transfer storage + Mongo state',
            icon: ArrowRightLeft,
            disabled: row.teamCluster.status !== TeamClusterStatus.Connected || !row.teamCluster.effectiveCapabilities.servesStorageReads,
            onClick: () => handleTransferData(row.teamCluster)
        },
        {
            label: 'Explore Mongo Documents',
            icon: Database,
            onClick: () => navigate(`/dashboard/clusters/${row.id}/mongo`)
        },
        {
            label: 'Explore Redis Data',
            icon: Database,
            onClick: () => navigate(`/dashboard/clusters/${row.id}/redis`)
        },
        {
            label: 'Explore MinIO',
            icon: FolderOpen,
            onClick: () => navigate(`/dashboard/clusters/${row.id}/minio`)
        },
        {
            label: 'Delete cluster',
            icon: Trash2,
            destructive: true,
            onClick: () => handleDeleteCluster(row.teamCluster)
        }
    ], [handleDeleteCluster, handleQueueConcurrency, handleRevealCredentials, handleRoleChange, handleShowInstallCommand, handleTransferData, navigate]);

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
                queryKey={TEAM_CLUSTER_QUERY_KEYS.byTeam(vm.selectedTeamId ?? '')}
                columns={columns}
                fetchData={vm.fetchClusters}
                getMenuOptions={getMenuOptions}
                onItemClick={(row) => {
                    navigate(`/dashboard/clusters/${row.id}`);
                    return true;
                }}
                defaultLimit={20}
                emptyMessage='No clusters found.'
                emptyIcon={<ClustersEmptyState />}
                createNew={createNew}
                hideTabs
                enabled={Boolean(vm.selectedTeamId)}
                socketInvalidation={socketInvalidation}
            />
        </>
    );
};

export default ClustersListing;
