import ClusterRemoteAccessModal, { CLUSTER_REMOTE_ACCESS_MODAL_ID } from '@/modules/cluster/components/ClusterRemoteAccessModal';
import useClusterRemoteAccessPage from '@/modules/cluster/hooks/use-cluster-remote-access-page';
import useClusterManagement from '@/modules/cluster/hooks/use-cluster-management';
import { TeamClusterRemoteAccessTarget } from '@/modules/cluster/api/entities/team-cluster-remote-access';
import Loader from '@/shared/presentation/primitives/Loader';
import { openModal } from '@/shared/presentation/primitives/Modal';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import useTip from '@/shared/tips/use-tip';
import { lazy, Suspense, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
interface SegmentTargetMapping {
    segment: string;
    target: TeamClusterRemoteAccessTarget;
    title: string;
}

const SEGMENT_TARGET_MAP: SegmentTargetMapping[] = [
    { segment: 'mongo', target: TeamClusterRemoteAccessTarget.MongoDocuments, title: 'Mongo Explorer' },
    { segment: 'redis', target: TeamClusterRemoteAccessTarget.RedisData, title: 'Redis Explorer' },
    { segment: 'minio', target: TeamClusterRemoteAccessTarget.Minio, title: 'MinIO Explorer' }
];

/** Fallback used to satisfy hook call order when the URL segment is invalid. */
const DEFAULT_TARGET = TeamClusterRemoteAccessTarget.MongoDocuments;
const ClusterRemoteExplorerContent = lazy(() => import('@/modules/cluster/components/ClusterRemoteExplorerContent'));

/**
 * Resolves the remote explorer mapping from the last segment of the current URL.
 * Returns `null` when the segment does not map to any known explorer target.
 */
const resolveTargetMappingFromPathname = (pathname: string): SegmentTargetMapping | null => {
    const lastSegment = pathname.split('/').filter(Boolean).pop();
    return SEGMENT_TARGET_MAP.find((mapping) => mapping.segment === lastSegment) ?? null;
};

/**
 * Shared page template for Mongo, Redis, and MinIO cluster remote explorers.
 * Derives the `TeamClusterRemoteAccessTarget` from the trailing URL segment
 * and delegates to the password-confirmation → explorer-content two-phase flow.
 */
const ClusterRemoteExplorerPage = () => {
    useTip('cluster-remote-explorer');

    const { pathname } = useLocation();
    const navigate = useNavigate();
    const clusterManagement = useClusterManagement();

    const targetMapping = useMemo(() => resolveTargetMappingFromPathname(pathname), [pathname]);
    const target = targetMapping?.target ?? null;
    const vm = useClusterRemoteAccessPage(target ?? DEFAULT_TARGET);

    usePageTitle(vm.cluster && targetMapping ? `${vm.cluster.name} - ${targetMapping.title}` : targetMapping?.title ?? 'Cluster Explorer');

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
        return (
            <Stack gap='075' p='2' flex='1' className='justify-center'>
                <div className='font-size-3 font-weight-6'>Preparing cluster explorer</div>
                <Text as='p' tone='secondary'>
                    Restoring cluster access context and remote explorer session.
                </Text>
            </Stack>
        );
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
        <Stack flex='1' overflow='hidden' p='1' className='vh-max'>
            <Suspense fallback={<Loader scale={0.5} isFixed={false} />}>
                <ClusterRemoteExplorerContent
                    teamCluster={vm.cluster}
                    target={target}
                    session={vm.session}
                    listEntries={clusterManagement.listRemoteExplorerEntries}
                    getNode={clusterManagement.getRemoteExplorerNode}
                    downloadObject={clusterManagement.downloadRemoteExplorerObject}
                />
            </Suspense>
        </Stack>
    );
};

export default ClusterRemoteExplorerPage;
