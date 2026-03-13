import ClusterRemoteAccessModal, { CLUSTER_REMOTE_ACCESS_MODAL_ID } from '@/modules/cluster/components/organisms/ClusterRemoteAccessModal';
import ClusterRemoteExplorerContent from '@/modules/cluster/components/organisms/ClusterRemoteExplorerContent';
import useClusterRemoteAccessPage from '@/modules/cluster/hooks/use-cluster-remote-access-page';
import useClusterManagement from '@/modules/cluster/hooks/use-cluster-management';
import { TeamClusterRemoteAccessTarget } from '@/modules/cluster/api/entities/team-cluster-remote-access';
import { openModal } from '@/shared/presentation/components/Modal';
import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface SegmentTargetMapping {
    segment: string;
    target: TeamClusterRemoteAccessTarget;
};

const SEGMENT_TARGET_MAP: SegmentTargetMapping[] = [
    { segment: 'mongo', target: TeamClusterRemoteAccessTarget.MongoDocuments },
    { segment: 'redis', target: TeamClusterRemoteAccessTarget.RedisData },
    { segment: 'minio', target: TeamClusterRemoteAccessTarget.Minio }
];

/** Fallback used to satisfy hook call order when the URL segment is invalid. */
const DEFAULT_TARGET = TeamClusterRemoteAccessTarget.MongoDocuments;

/**
 * Resolves the remote access target from the last segment of the current URL.
 * Returns `null` when the segment does not map to any known explorer target.
 */
const resolveTargetFromPathname = (pathname: string): TeamClusterRemoteAccessTarget | null => {
    const lastSegment = pathname.split('/').filter(Boolean).pop();
    const match = SEGMENT_TARGET_MAP.find((mapping) => mapping.segment === lastSegment);
    return match?.target ?? null;
};

/**
 * Shared page template for Mongo, Redis, and MinIO cluster remote explorers.
 * Derives the `TeamClusterRemoteAccessTarget` from the trailing URL segment
 * and delegates to the password-confirmation → explorer-content two-phase flow.
 */
const ClusterRemoteExplorerPage = () => {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const clusterManagement = useClusterManagement();

    const target = useMemo(() => resolveTargetFromPathname(pathname), [pathname]);
    const vm = useClusterRemoteAccessPage(target ?? DEFAULT_TARGET);

    useEffect(() => {
        if (!target) {
            navigate('/dashboard/clusters', { replace: true });
        }
    }, [target, navigate]);

    useEffect(() => {
        if (target && vm.cluster && !vm.isAuthenticated) {
            openModal(CLUSTER_REMOTE_ACCESS_MODAL_ID);
        }
    }, [target, vm.cluster, vm.isAuthenticated]);

    const handleDismiss = () => {
        navigate('/dashboard/clusters', { replace: true });
    };

    if (!target) {
        return null;
    }

    if (!vm.cluster) {
        return <Loader scale={0.5} isFixed={false} />;
    }

    if (!vm.isAuthenticated || !vm.session) {
        return (
            <>
                <Loader scale={0.5} isFixed={false} />
                <ClusterRemoteAccessModal
                    target={target}
                    clusterName={vm.cluster.name}
                    isLoading={vm.isLoading}
                    error={vm.error}
                    onSubmit={vm.handleSubmit}
                    onDismiss={handleDismiss}
                />
            </>
        );
    }

    return (
        <Container className='d-flex column flex-1 overflow-hidden vh-max p-1'>
            <ClusterRemoteExplorerContent
                teamCluster={vm.cluster}
                target={target}
                session={vm.session}
                listEntries={clusterManagement.listRemoteExplorerEntries}
                getNode={clusterManagement.getRemoteExplorerNode}
                downloadObject={clusterManagement.downloadRemoteExplorerObject}
            />
        </Container>
    );
};

export default ClusterRemoteExplorerPage;
