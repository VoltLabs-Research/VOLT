import useClusterManagement from '@/modules/cluster/hooks/use-cluster-management';
import { useState } from 'react';
import type { DeleteTeamClusterOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/delete-team-cluster';
import type { RequestClusterUpdateOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/request-cluster-update';
import type { TeamCluster, TeamClusterCredentialServices } from '@/modules/cluster/api/entities/team-cluster';

export interface ClusterPageState {
    clusters: TeamCluster[];
    selectedTeamId: string | null;
    selectedCluster: TeamCluster | null;
    selectedClusterId: string | null;
    setSelectedClusterId: (clusterId: string | null) => void;
    revealCredentials: (password: string) => Promise<void>;
    deleteCluster: (password: string) => Promise<DeleteTeamClusterOutputDTO>;
    requestUpdate: (targetVersion: string, isEdge: boolean, password: string) => Promise<RequestClusterUpdateOutputDTO>;
    credentials: TeamClusterCredentialServices | null;
    credentialsCluster: TeamCluster | null;
    deleteTarget: TeamCluster | null;
    updateTarget: TeamCluster | null;
    setCredentialsCluster: (teamCluster: TeamCluster | null) => void;
    setDeleteTarget: (teamCluster: TeamCluster | null) => void;
    setUpdateTarget: (teamCluster: TeamCluster | null) => void;
    isLoading: boolean;
};

const useClusterPageState = (): ClusterPageState => {
    const management = useClusterManagement();
    const [credentials, setCredentials] = useState<TeamClusterCredentialServices | null>(null);
    const [credentialsCluster, setCredentialsCluster] = useState<TeamCluster | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<TeamCluster | null>(null);
    const [updateTarget, setUpdateTarget] = useState<TeamCluster | null>(null);

    const revealCredentials = async (password: string) => {
        if (!credentialsCluster) {
            return;
        }

        const nextCredentials = await management.revealCredentials(credentialsCluster._id, password);
        setCredentials(nextCredentials);
    };

    const deleteCluster = async (password: string) => {
        if (!deleteTarget) {
            throw new Error('Missing cluster delete target');
        }

        return management.deleteCluster(deleteTarget._id, password);
    };

    const requestUpdate = async (targetVersion: string, isEdge: boolean, password: string) => {
        if (!updateTarget) {
            throw new Error('Missing cluster update target');
        }

        return management.requestUpdate(updateTarget._id, targetVersion, isEdge, password);
    };

    return {
        clusters: management.clusters,
        selectedTeamId: management.selectedTeamId,
        selectedCluster: management.selectedCluster,
        selectedClusterId: management.selectedClusterId,
        setSelectedClusterId: management.setSelectedClusterId,
        revealCredentials,
        deleteCluster,
        requestUpdate,
        credentials,
        credentialsCluster,
        deleteTarget,
        updateTarget,
        setCredentialsCluster: (teamCluster) => {
            setCredentials(null);
            setCredentialsCluster(teamCluster);
        },
        setDeleteTarget,
        setUpdateTarget,
        isLoading: management.isLoading
    };
};

export default useClusterPageState;
