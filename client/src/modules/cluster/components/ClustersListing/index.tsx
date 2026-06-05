import ClusterQueueConcurrencyModal, {
    CLUSTER_QUEUE_CONCURRENCY_MODAL_ID
} from '@/modules/cluster/components/ClusterQueueConcurrencyModal';
import ClusterRoleModal, { CLUSTER_ROLE_MODAL_ID } from '@/modules/cluster/components/ClusterRoleModal';
import ClusterTransferModal, { CLUSTER_TRANSFER_MODAL_ID } from '@/modules/cluster/components/ClusterTransferModal';
import ClusterCredentialsModal, { CLUSTER_CREDENTIALS_MODAL_ID } from '@/modules/cluster/components/ClusterCredentialsModal';
import ClusterInstallCommandModal, { CLUSTER_INSTALL_COMMAND_MODAL_ID } from '@/modules/cluster/components/ClusterInstallCommandModal';
import Button from '@/shared/presentation/primitives/Button';
import Heading from '@/shared/presentation/primitives/Heading';
import DeleteClusterModal, { DELETE_CLUSTER_MODAL_ID } from '@/modules/cluster/components/DeleteClusterModal';
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
import { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';
import { isTeamClusterWaiting } from '@/modules/cluster/utilities/is-team-cluster-waiting';
import { SOCKET_TEAM_CLUSTER_EVENTS } from '@/modules/socket/events/cluster';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import Box from '@/shared/presentation/primitives/Box';
import { openModal } from '@/shared/presentation/primitives/Modal';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import StatusBadge from '@/shared/presentation/primitives/StatusBadge';
import Text from '@/shared/presentation/primitives/Text';
import { ArrowRightLeft, Database, FolderOpen, KeyRound, Monitor, Settings2, TerminalSquare, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';
import type { SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListingTable';
import type { MenuOption } from '@/shared/presentation/types/menu';
import type { ServerRow } from '@/modules/cluster/utilities/transform-cluster-row';
import '@/modules/cluster/components/ServerTable/ServerTable.css';
import { useNavigate } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';

const CLUSTER_EXPLORER_MENU_ITEMS: Array<Pick<MenuOption, 'label' | 'icon'> & { segment: string }> = [
    { label: 'Explore Mongo Documents', segment: 'mongo', icon: Database },
    { label: 'Explore Redis Data', segment: 'redis', icon: Database },
    { label: 'Explore MinIO', segment: 'minio', icon: FolderOpen }
];

const renderMetricBars = (percentage: number, label: string): ReactNode => {
    const activeBars = Math.floor(percentage / 20);
    return (
        <Row gap='05'>
            <Box display='flex' className='gap-01'>
                {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className={`server-table-bar ${i < activeBars ? 'server-table-bar-active' : ''}`} />
                ))}
            </Box>
            <Text as='p' size='sm' tone='muted'>{label}</Text>
        </Row>
    );
};

const renderMetricValue = (value: number | null): ReactNode => {
    return value === null
        ? <Text as='p' size='sm' tone='muted'>--</Text>
        : renderMetricBars(value, `${value}%`);
};

const renderDiskValue = (row: ServerRow): ReactNode => {
    if (row.diskUsagePercent === null || row.diskFree === null) {
        return <Text as='p' size='sm' tone='muted'>--</Text>;
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

const createExplorerMenuOptions = (row: ServerRow, navigate: NavigateFunction): MenuOption[] => {
    return CLUSTER_EXPLORER_MENU_ITEMS.map(({ label, segment, icon }) => ({
        label,
        icon,
        onClick: () => navigate(`/dashboard/clusters/${row.id}/${segment}`)
    }));
};

const ClustersListing = () => {
    const navigate = useNavigate();
    const state = useClusterPageState();
    const vm = useClustersListingPage();
    const [installCommandClusterId, setInstallCommandClusterId] = useState<string | null>(null);
    const [installCommandToken, setInstallCommandToken] = useState<string | null>(null);
    const regenerateTokenMutation = useRegenerateTeamClusterEnrollmentTokenMutation();
    const createNew = useMemo(() => ({
        buttonTitle: 'Add new Cluster',
        onCreate: () => navigate('/onboarding/cluster/setup')
    }), [navigate]);

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
                event: SOCKET_TEAM_CLUSTER_EVENTS.LIFECYCLE_UPDATED,
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
                <Row gap='05'>
                    <Text as='p' size='md' tone='secondary'>{row.name}</Text>
                </Row>
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
                    <Stack gap='025'>
                        <StatusBadge variant={getTeamClusterRoleBadgeVariant(row.desiredRole)} size='compact'>
                            {getTeamClusterRoleLabel(row.desiredRole)}
                        </StatusBadge>
                        <Text as='p' size='sm' className={isTransitionPending ? 'color-warning' : 'color-muted'}>
                            {isTransitionPending
                                ? `${drainingSummary ? `${drainingSummary}, ` : ''}effective ${getTeamClusterRoleLabel(row.effectiveRole)}`
                                : getTeamClusterRoleSummary(row.desiredRole)}
                        </Text>
                    </Stack>
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
            render: (_, row) => <Text as='p' size='sm' tone='secondary'>{formatClusterTimestamp(row.lastHeartbeatAt)}</Text>
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
        ...createExplorerMenuOptions(row, navigate),
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
                emptyIcon={(
                    <Stack align='start' gap='1' p='1-5' radius='lg' className='clusters-empty-state'>
                        <Heading level={3} size='xl' weight='bold'>No clusters connected yet</Heading>
                        <Text as='p' size='md' tone='secondary'>
                            Create a team cluster to provision your first compute environment and unlock live metrics on this dashboard.
                        </Text>
                        <Button variant='solid' intent='brand' to='/onboarding/cluster/setup'>Add New Cluster</Button>
                    </Stack>
                )}
                createNew={createNew}
                hideTabs
                enabled={Boolean(vm.selectedTeamId)}
                socketInvalidation={socketInvalidation}
            />
        </>
    );
};

export default ClustersListing;
