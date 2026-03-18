import ClusterCredentialsModal, { CLUSTER_CREDENTIALS_MODAL_ID } from '@/modules/cluster/components/organisms/ClusterCredentialsModal';
import ClusterInstallCommandModal, { CLUSTER_INSTALL_COMMAND_MODAL_ID } from '@/modules/cluster/components/organisms/ClusterInstallCommandModal';
import ClustersEmptyState from '@/modules/cluster/components/organisms/ClustersEmptyState';
import DeleteClusterModal, { DELETE_CLUSTER_MODAL_ID } from '@/modules/cluster/components/organisms/DeleteClusterModal';
import UpdateClusterModal, { UPDATE_CLUSTER_MODAL_ID } from '@/modules/cluster/components/organisms/UpdateClusterModal';
import useClusterPageState from '@/modules/cluster/hooks/use-cluster-page-state';
import useClustersListingPage from '@/modules/cluster/hooks/use-clusters-listing-page';
import { invalidateAvailableVersionsQuery, useRegenerateTeamClusterEnrollmentTokenMutation, useUpdateTeamClusterRoleMutation, TEAM_CLUSTER_QUERY_KEYS } from '@/modules/cluster/hooks/team-cluster/queries';
import { formatClusterTimestamp } from '@/modules/cluster/utilities/format-cluster-timestamp';
import { getTeamClusterStatusLabel, getTeamClusterStatusVariant } from '@/modules/cluster/utilities/team-cluster-status';
import { TeamClusterStatus, TeamClusterRole } from '@/modules/cluster/api/entities/team-cluster';
import { CLUSTER_ROLE_OPTIONS } from '@/modules/cluster/constants';
import { isTeamClusterWaiting } from '@/modules/cluster/utilities/is-team-cluster-waiting';
import { TEAM_CLUSTER_SOCKET_EVENTS } from '@/modules/cluster/api/service/endpoints/team-cluster-socket-events';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import MetricBars from '@/modules/cluster/components/organisms/MetricBars';
import Paragraph from '@/shared/presentation/components/Paragraph';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import Container from '@/shared/presentation/components/Container';
import { openModal } from '@/shared/presentation/components/Modal';
import { Check, Database, FolderOpen, KeyRound, Layers, Monitor, RefreshCw, Terminal, TerminalSquare, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';
import type { ColumnConfig, MenuOption, SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import type { ServerRow } from '@/modules/cluster/utilities/transform-cluster-row';
import '@/modules/cluster/components/organisms/ServerTable/ServerTable.css';

const ClustersListing = () => {
    const navigate = useNavigate();
    const state = useClusterPageState();
    const vm = useClustersListingPage();
    const [installCommandClusterId, setInstallCommandClusterId] = useState<string | null>(null);
    const [installCommandToken, setInstallCommandToken] = useState<string | null>(null);
    const regenerateTokenMutation = useRegenerateTeamClusterEnrollmentTokenMutation();
    const updateRoleMutation = useUpdateTeamClusterRoleMutation();
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

    const handleUpdateCluster = useCallback((cluster: TeamCluster) => {
        state.setUpdateTarget(cluster);
        if (vm.selectedTeamId) {
            invalidateAvailableVersionsQuery(vm.selectedTeamId, cluster._id);
        }
        openModal(UPDATE_CLUSTER_MODAL_ID);
    }, [state, vm.selectedTeamId]);

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

    const handleChangeRole = useCallback((cluster: TeamCluster, role: TeamClusterRole) => {
        if (!vm.selectedTeamId || cluster.role === role) return;
        updateRoleMutation.mutate({
            teamId: vm.selectedTeamId,
            teamClusterId: cluster._id,
            role
        });
    }, [vm.selectedTeamId, updateRoleMutation]);

    const buildRoleSubmenu = useCallback((cluster: TeamCluster) => (
        <>
            {CLUSTER_ROLE_OPTIONS.map((option) => (
                <PopoverMenuItem
                    key={option.value}
                    size='sm'
                    disabled={cluster.role === option.value}
                    onClick={() => handleChangeRole(cluster, option.value)}
                    icon={cluster.role === option.value ? <Check size={14} /> : undefined}
                >
                    {option.label}
                </PopoverMenuItem>
            ))}
        </>
    ), [handleChangeRole]);

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

    const columns = useMemo<ColumnConfig<ServerRow>[]>(() => [
        {
            key: 'name',
            title: 'Cluster',
            sortable: true,
            width: 240,
            render: (_, row) => (
                <Container className='d-flex column gap-025'>
                    <Container className='d-flex items-center gap-05'>
                        <Paragraph className='font-size-2 color-secondary'>{row.name}</Paragraph>
                    </Container>
                    <Paragraph className='font-size-1 color-muted font-family-mono'>{row.id}</Paragraph>
                </Container>
            )
        },
        {
            key: 'role',
            title: 'Role',
            sortable: true,
            width: 140,
            render: (_, row) => (
                <StatusBadge variant='neutral' size='compact'>
                    {row.role}
                </StatusBadge>
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
            key: 'status',
            title: 'Metrics',
            sortable: true,
            width: 160,
            render: (_, row) => (
                <StatusBadge status={row.status} />
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
            render: (_, row) => (
                <Container className='d-flex items-center gap-05'>
                    <MetricBars percentage={row.cpu} />
                    <Paragraph className='font-size-1 color-muted'>{row.cpu}%</Paragraph>
                </Container>
            )
        },
        {
            key: 'memory',
            title: 'Memory',
            sortable: true,
            width: 180,
            render: (_, row) => (
                <Container className='d-flex items-center gap-05'>
                    <MetricBars percentage={row.memory} />
                    <Paragraph className='font-size-1 color-muted'>{row.memory}%</Paragraph>
                </Container>
            )
        },
        {
            key: 'diskUsagePercent',
            title: 'Disk',
            sortable: true,
            width: 220,
            render: (_, row) => (
                <Container className='d-flex items-center gap-05'>
                    <MetricBars percentage={row.diskUsagePercent} />
                    <Paragraph className='font-size-1 color-muted'>{row.diskFree.toFixed(1)}GB Available</Paragraph>
                </Container>
            )
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
            width: 180
        },
        {
            key: 'uptime',
            title: 'Uptime',
            sortable: true,
            width: 140,
            render: (_, row) => <Paragraph className='font-size-2 font-weight-5 color-secondary'>{row.uptime}</Paragraph>
        }
    ], []);

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
            label: 'Update cluster',
            icon: RefreshCw,
            disabled: row.teamCluster.status !== TeamClusterStatus.Connected && row.teamCluster.status !== TeamClusterStatus.UpdateFailed,
            onClick: () => handleUpdateCluster(row.teamCluster)
        },
        {
            label: 'Open terminal',
            icon: Terminal,
            onClick: () => navigate(`/dashboard/clusters/${row.id}/terminal`)
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
            label: 'Change role',
            icon: Layers,
            submenuContent: buildRoleSubmenu(row.teamCluster)
        },
        {
            label: 'Delete cluster',
            icon: Trash2,
            destructive: true,
            onClick: () => handleDeleteCluster(row.teamCluster)
        }
    ], [buildRoleSubmenu, handleDeleteCluster, handleRevealCredentials, handleShowInstallCommand, handleUpdateCluster, navigate]);

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
            <UpdateClusterModal
                teamCluster={state.updateTarget}
                teamId={state.selectedTeamId}
                onUpdate={state.requestUpdate}
                onClose={() => state.setUpdateTarget(null)}
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
