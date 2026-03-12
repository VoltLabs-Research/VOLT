import ClusterRemoteAccessModal, { CLUSTER_REMOTE_ACCESS_MODAL_ID } from '@/modules/cluster/components/organisms/ClusterRemoteAccessModal';
import ClusterRemoteTerminalContent from '@/modules/cluster/components/organisms/ClusterRemoteTerminalContent';
import useClusterRemoteAccessPage from '@/modules/cluster/hooks/use-cluster-remote-access-page';
import { DASHBOARD_LAYOUT_EVENTS } from '@/modules/dashboard/utilities/layout-events';
import { TeamClusterRemoteAccessTarget } from '@/modules/cluster/api/entities/team-cluster-remote-access';
import { openModal } from '@/shared/presentation/components/Modal';
import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const ClusterTerminalPage = () => {
    const vm = useClusterRemoteAccessPage(TeamClusterRemoteAccessTarget.HostTerminal);
    const navigate = useNavigate();
    const didCollapseSidebar = useRef(false);

    useEffect(() => {
        didCollapseSidebar.current = true;
        window.dispatchEvent(new CustomEvent(DASHBOARD_LAYOUT_EVENTS.requestSidebarCollapse));

        return () => {
            if (didCollapseSidebar.current) {
                window.dispatchEvent(new CustomEvent(DASHBOARD_LAYOUT_EVENTS.requestSidebarExpand));
            }
        };
    }, []);

    useEffect(() => {
        if (vm.cluster && !vm.isAuthenticated) {
            openModal(CLUSTER_REMOTE_ACCESS_MODAL_ID);
        }
    }, [vm.cluster, vm.isAuthenticated]);

    const handleDismiss = () => {
        navigate('/dashboard/clusters', { replace: true });
    };

    if (!vm.cluster) {
        return <Loader scale={0.5} isFixed={false} />;
    }

    if (!vm.isAuthenticated || !vm.session) {
        return (
            <>
                <Loader scale={0.5} isFixed={false} />
                <ClusterRemoteAccessModal
                    target={TeamClusterRemoteAccessTarget.HostTerminal}
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
        <Container className='d-flex column flex-1 overflow-hidden vh-max'>
            <ClusterRemoteTerminalContent teamCluster={vm.cluster} session={vm.session} />
        </Container>
    );
};

export default ClusterTerminalPage;
