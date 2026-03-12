import { teamClusterService } from '@/modules/cluster/api/service/team-cluster';
import {
    invalidateAvailableVersionsQuery,
    useTeamClustersQuery,
    useRevealTeamClusterCredentialsMutation,
    useRequestClusterUpdateMutation
} from '@/modules/cluster/hooks/team-cluster/queries';
import { CLUSTER_CREDENTIALS_MODAL_ID } from '@/modules/cluster/components/organisms/ClusterCredentialsModal';
import {
    CLUSTER_REMOTE_ACCESS_PASSWORD_MODAL_ID
} from '@/modules/cluster/components/organisms/ClusterRemoteAccessPasswordModal';
import {
    CLUSTER_REMOTE_EXPLORER_MODAL_ID
} from '@/modules/cluster/components/organisms/ClusterRemoteExplorerModal';
import {
    CLUSTER_REMOTE_TERMINAL_MODAL_ID
} from '@/modules/cluster/components/organisms/ClusterRemoteTerminal';
import { UPDATE_CLUSTER_MODAL_ID } from '@/modules/cluster/components/organisms/UpdateClusterModal';
import { TeamClusterRemoteAccessTarget } from '@/modules/cluster/api/entities/team-cluster-remote-access';
import { openModal } from '@/shared/presentation/components/Modal';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { TeamCluster, TeamClusterCredentialServices } from '@/modules/cluster/api/entities/team-cluster';
import type {
    TeamClusterRemoteAccessSession,
    TeamClusterRemoteExplorerEntry,
    TeamClusterRemoteExplorerNode
} from '@/modules/cluster/api/entities/team-cluster-remote-access';
import type { RequestClusterUpdateOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/request-cluster-update';

interface RemoteAccessRequestState {
    teamCluster: TeamCluster;
    target: TeamClusterRemoteAccessTarget;
};

interface RemoteTerminalState {
    teamCluster: TeamCluster;
    session: TeamClusterRemoteAccessSession;
};

interface RemoteExplorerState extends RemoteTerminalState {
    target: TeamClusterRemoteAccessTarget;
};

interface SidebarClustersResult {
    clusters: TeamCluster[];
    selectedTeamId: string | null;
    isOnClustersRoute: boolean;
    credentialsCluster: TeamCluster | null;
    credentials: TeamClusterCredentialServices | null;
    updateTarget: TeamCluster | null;
    remoteAccessRequest: RemoteAccessRequestState | null;
    remoteTerminal: RemoteTerminalState | null;
    remoteExplorer: RemoteExplorerState | null;
    handleMonitor: (cluster: TeamCluster) => void;
    handleRevealCredentials: (cluster: TeamCluster) => void;
    handleUpdateCluster: (cluster: TeamCluster) => void;
    handleOpenTerminal: (cluster: TeamCluster) => void;
    handleExploreMongo: (cluster: TeamCluster) => void;
    handleExploreRedis: (cluster: TeamCluster) => void;
    handleExploreMinio: (cluster: TeamCluster) => void;
    revealCredentials: (password: string) => Promise<void>;
    requestUpdate: (targetVersion: string, isEdge: boolean, password: string) => Promise<RequestClusterUpdateOutputDTO>;
    submitRemoteAccessRequest: (password: string) => Promise<void>;
    closeRemoteTerminal: () => void;
    closeRemoteExplorer: () => void;
    listRemoteExplorerEntries: (
        teamClusterId: string,
        sessionId: string,
        target: TeamClusterRemoteAccessTarget,
        path: string
    ) => Promise<TeamClusterRemoteExplorerEntry[]>;
    getRemoteExplorerNode: (
        teamClusterId: string,
        sessionId: string,
        target: TeamClusterRemoteAccessTarget,
        path: string
    ) => Promise<TeamClusterRemoteExplorerNode>;
    setCredentialsCluster: (cluster: TeamCluster | null) => void;
    setUpdateTarget: (cluster: TeamCluster | null) => void;
    setRemoteAccessRequest: (state: RemoteAccessRequestState | null) => void;
};

/**
 * Lightweight hook for sidebar cluster actions. Fetches the team's clusters
 * and manages modal state for credential reveal, update, terminal, and explorer flows.
 *
 * When the user is already on a clusters route, modal-based actions navigate
 * to the cluster monitoring page instead of opening modals, avoiding duplicate
 * modal ID conflicts with the page-level modals.
 */
const useSidebarClusters = (setSidebarOpen: (open: boolean) => void): SidebarClustersResult => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const selectedTeamId = useSelectedTeamId();

    const isOnClustersRoute = pathname.startsWith('/dashboard/clusters');

    const { data } = useTeamClustersQuery(selectedTeamId ?? '');
    const clusters = data?.data ?? [];

    const [credentials, setCredentials] = useState<TeamClusterCredentialServices | null>(null);
    const [credentialsCluster, setCredentialsCluster] = useState<TeamCluster | null>(null);
    const [updateTarget, setUpdateTarget] = useState<TeamCluster | null>(null);
    const [remoteAccessRequest, setRemoteAccessRequest] = useState<RemoteAccessRequestState | null>(null);
    const [remoteTerminal, setRemoteTerminal] = useState<RemoteTerminalState | null>(null);
    const [remoteExplorer, setRemoteExplorer] = useState<RemoteExplorerState | null>(null);

    const revealCredentialsMutation = useRevealTeamClusterCredentialsMutation();
    const updateMutation = useRequestClusterUpdateMutation();

    const navigateToCluster = useCallback((cluster: TeamCluster) => {
        navigate(`/dashboard/clusters/${cluster._id}`);
        setSidebarOpen(false);
    }, [navigate, setSidebarOpen]);

    const handleMonitor = useCallback((cluster: TeamCluster) => {
        navigateToCluster(cluster);
    }, [navigateToCluster]);

    const handleRevealCredentials = useCallback((cluster: TeamCluster) => {
        if (isOnClustersRoute) {
            navigateToCluster(cluster);
            return;
        }

        setCredentials(null);
        setCredentialsCluster(cluster);
        openModal(CLUSTER_CREDENTIALS_MODAL_ID);
    }, [isOnClustersRoute, navigateToCluster]);

    const handleUpdateCluster = useCallback((cluster: TeamCluster) => {
        if (isOnClustersRoute) {
            navigateToCluster(cluster);
            return;
        }

        setUpdateTarget(cluster);
        if (selectedTeamId) {
            invalidateAvailableVersionsQuery(selectedTeamId, cluster._id);
        }
        openModal(UPDATE_CLUSTER_MODAL_ID);
    }, [isOnClustersRoute, navigateToCluster, selectedTeamId]);

    const handleRemoteAccess = useCallback((cluster: TeamCluster, target: TeamClusterRemoteAccessTarget) => {
        if (isOnClustersRoute) {
            navigateToCluster(cluster);
            return;
        }

        setRemoteAccessRequest({ teamCluster: cluster, target });
        openModal(CLUSTER_REMOTE_ACCESS_PASSWORD_MODAL_ID);
    }, [isOnClustersRoute, navigateToCluster]);

    const handleOpenTerminal = useCallback((cluster: TeamCluster) => {
        handleRemoteAccess(cluster, TeamClusterRemoteAccessTarget.HostTerminal);
    }, [handleRemoteAccess]);

    const handleExploreMongo = useCallback((cluster: TeamCluster) => {
        handleRemoteAccess(cluster, TeamClusterRemoteAccessTarget.MongoDocuments);
    }, [handleRemoteAccess]);

    const handleExploreRedis = useCallback((cluster: TeamCluster) => {
        handleRemoteAccess(cluster, TeamClusterRemoteAccessTarget.RedisData);
    }, [handleRemoteAccess]);

    const handleExploreMinio = useCallback((cluster: TeamCluster) => {
        handleRemoteAccess(cluster, TeamClusterRemoteAccessTarget.Minio);
    }, [handleRemoteAccess]);

    const revealCredentials = useCallback(async (password: string) => {
        if (!credentialsCluster || !selectedTeamId) {
            return;
        }

        const result = await showPromise(
            revealCredentialsMutation.mutateAsync({
                teamId: selectedTeamId,
                teamClusterId: credentialsCluster._id,
                password
            }),
            {
                loading: { title: 'Revealing credentials...' },
                success: { title: 'Credentials revealed' },
                error: { title: 'Failed to reveal credentials' }
            }
        );

        setCredentials(result.services);
    }, [credentialsCluster, selectedTeamId, revealCredentialsMutation]);

    const requestUpdate = useCallback(async (targetVersion: string, isEdge: boolean, password: string) => {
        if (!updateTarget || !selectedTeamId) {
            throw new Error('Missing cluster update target');
        }

        return showPromise(
            updateMutation.mutateAsync({
                teamId: selectedTeamId,
                teamClusterId: updateTarget._id,
                targetVersion,
                isEdge,
                password
            }),
            {
                loading: { title: 'Requesting cluster update...' },
                success: { title: 'Update requested' },
                error: { title: 'Failed to request cluster update' }
            }
        );
    }, [updateTarget, selectedTeamId, updateMutation]);

    const submitRemoteAccessRequest = useCallback(async (password: string) => {
        if (!remoteAccessRequest || !selectedTeamId) {
            throw new Error('Missing remote access request');
        }

        const toastOptions = {
            'host-terminal': {
                loading: { title: 'Opening terminal...' },
                success: { title: 'Terminal ready' },
                error: { title: 'Failed to open terminal' }
            },
            'mongo-documents': {
                loading: { title: 'Opening Mongo explorer...' },
                success: { title: 'Mongo explorer ready' },
                error: { title: 'Failed to open Mongo explorer' }
            },
            'redis-data': {
                loading: { title: 'Opening Redis explorer...' },
                success: { title: 'Redis explorer ready' },
                error: { title: 'Failed to open Redis explorer' }
            },
            minio: {
                loading: { title: 'Opening MinIO explorer...' },
                success: { title: 'MinIO explorer ready' },
                error: { title: 'Failed to open MinIO explorer' }
            }
        };

        const result = await showPromise(
            teamClusterService.createRemoteAccessSession({
                teamId: selectedTeamId,
                teamClusterId: remoteAccessRequest.teamCluster._id,
                password,
                target: remoteAccessRequest.target
            }),
            toastOptions[remoteAccessRequest.target]
        );

        if (remoteAccessRequest.target === TeamClusterRemoteAccessTarget.HostTerminal) {
            setRemoteTerminal({
                teamCluster: remoteAccessRequest.teamCluster,
                session: result.session
            });
            setRemoteExplorer(null);
            openModal(CLUSTER_REMOTE_TERMINAL_MODAL_ID);
        } else {
            setRemoteExplorer({
                teamCluster: remoteAccessRequest.teamCluster,
                session: result.session,
                target: remoteAccessRequest.target
            });
            setRemoteTerminal(null);
            openModal(CLUSTER_REMOTE_EXPLORER_MODAL_ID);
        }

        setRemoteAccessRequest(null);
    }, [remoteAccessRequest, selectedTeamId]);

    const listRemoteExplorerEntries = useCallback(async (
        teamClusterId: string,
        sessionId: string,
        target: TeamClusterRemoteAccessTarget,
        path: string
    ) => {
        if (!selectedTeamId) {
            throw new Error('Missing selected team');
        }

        const result = await teamClusterService.listRemoteExplorerEntries({
            teamId: selectedTeamId,
            teamClusterId,
            sessionId,
            target,
            path
        });

        return result.entries;
    }, [selectedTeamId]);

    const getRemoteExplorerNode = useCallback(async (
        teamClusterId: string,
        sessionId: string,
        target: TeamClusterRemoteAccessTarget,
        path: string
    ) => {
        if (!selectedTeamId) {
            throw new Error('Missing selected team');
        }

        const result = await teamClusterService.getRemoteExplorerNode({
            teamId: selectedTeamId,
            teamClusterId,
            sessionId,
            target,
            path
        });

        return result.node;
    }, [selectedTeamId]);

    return {
        clusters,
        selectedTeamId,
        isOnClustersRoute,
        credentialsCluster,
        credentials,
        updateTarget,
        remoteAccessRequest,
        remoteTerminal,
        remoteExplorer,
        handleMonitor,
        handleRevealCredentials,
        handleUpdateCluster,
        handleOpenTerminal,
        handleExploreMongo,
        handleExploreRedis,
        handleExploreMinio,
        revealCredentials,
        requestUpdate,
        submitRemoteAccessRequest,
        closeRemoteTerminal: () => setRemoteTerminal(null),
        closeRemoteExplorer: () => setRemoteExplorer(null),
        listRemoteExplorerEntries,
        getRemoteExplorerNode,
        setCredentialsCluster: (cluster: TeamCluster | null) => {
            setCredentials(null);
            setCredentialsCluster(cluster);
        },
        setUpdateTarget,
        setRemoteAccessRequest
    };
};

export default useSidebarClusters;
