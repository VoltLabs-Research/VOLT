import { teamClusterService } from '@/modules/cluster/api/service/team-cluster';
import { useTeamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TeamClusterRemoteAccessTarget } from '@/modules/cluster/api/entities/team-cluster-remote-access';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';
import type { TeamClusterRemoteAccessSession } from '@/modules/cluster/api/entities/team-cluster-remote-access';

interface ClusterRemoteAccessRouteParams extends Record<string, string | undefined> {
    clusterId: string;
};

interface ClusterRemoteAccessToastOptions {
    loading: { title: string };
    success: { title: string };
    error: { title: string };
};

const REMOTE_ACCESS_TOAST_OPTIONS: Record<TeamClusterRemoteAccessTarget, ClusterRemoteAccessToastOptions> = {
    [TeamClusterRemoteAccessTarget.HostTerminal]: {
        loading: { title: 'Opening terminal...' },
        success: { title: 'Terminal ready' },
        error: { title: 'Failed to open terminal' }
    },
    [TeamClusterRemoteAccessTarget.MongoDocuments]: {
        loading: { title: 'Opening Mongo explorer...' },
        success: { title: 'Mongo explorer ready' },
        error: { title: 'Failed to open Mongo explorer' }
    },
    [TeamClusterRemoteAccessTarget.RedisData]: {
        loading: { title: 'Opening Redis explorer...' },
        success: { title: 'Redis explorer ready' },
        error: { title: 'Failed to open Redis explorer' }
    },
    [TeamClusterRemoteAccessTarget.Minio]: {
        loading: { title: 'Opening MinIO explorer...' },
        success: { title: 'MinIO explorer ready' },
        error: { title: 'Failed to open MinIO explorer' }
    }
};

export interface ClusterRemoteAccessPageState {
    cluster: TeamCluster | null;
    session: TeamClusterRemoteAccessSession | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    handleSubmit: (password: string) => Promise<void>;
};

/**
 * Shared hook for pages that require a password-confirmed remote access session.
 *
 * Reads `clusterId` from route params, resolves the cluster entity, and manages
 * the password → session creation flow. Redirects to `/dashboard/clusters` when
 * the cluster ID is invalid or not found.
 *
 * @param target - The remote access target (terminal, mongo, redis, minio).
 */
const useClusterRemoteAccessPage = (target: TeamClusterRemoteAccessTarget): ClusterRemoteAccessPageState => {
    const selectedTeamId = useSelectedTeamId();
    const params = useParams<ClusterRemoteAccessRouteParams>();
    const navigate = useNavigate();

    const clustersQuery = useTeamClustersQuery(selectedTeamId ?? '', {
        enabled: Boolean(selectedTeamId)
    });

    const clusters = clustersQuery.data?.data ?? [];
    const clusterId = params.clusterId;

    const cluster = useMemo(() => {
        if (!clusterId) {
            return null;
        }

        return clusters.find((c) => c._id === clusterId) ?? null;
    }, [clusters, clusterId]);

    const [session, setSession] = useState<TeamClusterRemoteAccessSession | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (clustersQuery.isLoading) {
            return;
        }

        if (!clusterId || (!cluster && clusters.length > 0)) {
            navigate('/dashboard/clusters', { replace: true });
        }
    }, [clusterId, cluster, clusters.length, clustersQuery.isLoading, navigate]);

    const handleSubmit = async (password: string): Promise<void> => {
        if (!selectedTeamId || !clusterId) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await showPromise(
                teamClusterService.createRemoteAccessSession({
                    teamId: selectedTeamId,
                    teamClusterId: clusterId,
                    password,
                    target
                }),
                REMOTE_ACCESS_TOAST_OPTIONS[target]
            );
            setSession(result.session);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to create remote access session';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        cluster,
        session,
        isAuthenticated: session !== null,
        isLoading,
        error,
        handleSubmit
    };
};

export default useClusterRemoteAccessPage;
