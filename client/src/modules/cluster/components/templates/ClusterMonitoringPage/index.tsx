import '@/modules/cluster/components/templates/ClusterMonitoringPage/ClusterMonitoringPage.css';
import ClustersEmptyState from '@/modules/cluster/components/organisms/ClustersEmptyState';
import MetricsCards from '@/modules/cluster/components/molecules/MetricsCards';
import useClusterMonitoringPage from '@/modules/cluster/hooks/use-cluster-monitoring-page';
import { getClusterMetricsRecoveryState } from '@/modules/cluster/utilities/cluster-live-metrics-status';
import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import RecoveryState from '@/shared/presentation/components/RecoveryState';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import useTip from '@/shared/tips/use-tip';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';

interface IdleCallbackHandle {
    cancel: () => void;
};

const CpuDistribution = lazy(() => import('@/modules/cluster/components/molecules/CpuDistribution'));
const DiskOperations = lazy(() => import('@/modules/cluster/components/molecules/DiskOperations'));
const ResourceUsage = lazy(() => import('@/modules/cluster/components/molecules/ResourceUsage'));
const NetworkChart = lazy(() => import('@/shared/presentation/components/NetworkChart'));

const createIdleCallbackHandle = (onIdle: () => void, timeoutMs: number): IdleCallbackHandle => {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        const idleCallbackId = window.requestIdleCallback(onIdle, { timeout: timeoutMs });

        return {
            cancel: () => {
                window.cancelIdleCallback(idleCallbackId);
            }
        };
    }

    const timeoutId = window.setTimeout(onIdle, timeoutMs);

    return {
        cancel: () => {
            window.clearTimeout(timeoutId);
        }
    };
};

const renderDeferredVisualizationsFallback = () => (
    <Container className='d-flex items-center justify-center p-2' style={{ minHeight: '18rem' }}>
        <Loader
            scale={0.35}
            isFixed={false}
            label='Loading live charts'
            announce
            reducedMotionLabel='Loading live charts' />
    </Container>
);

const ClusterMonitoringPage = () => {
    useTip('cluster-monitoring-live');

    const vm = useClusterMonitoringPage();
    const pageTitle = vm.selectedCluster ? `${vm.selectedCluster.name} - Monitoring` : 'Cluster Monitoring';
    const [shouldRenderVisualizations, setShouldRenderVisualizations] = useState(false);

    usePageTitle(pageTitle);

    const hasRenderableMetrics = Boolean(vm.hasClusters && vm.metrics);

    const networkData = useMemo(() => {
        if (!vm.metrics?.network) {
            return null;
        }

        return {
            rx: vm.metrics.network.incoming,
            tx: vm.metrics.network.outgoing
        };
    }, [vm.metrics]);

    const metricsUnavailableState = useMemo(() => {
        if (!vm.hasClusters || vm.metrics) {
            return null;
        }

        const clusterName = vm.selectedCluster?.name ?? 'This cluster';

        return getClusterMetricsRecoveryState({
            clusterName,
            isMetricsConnected: vm.isMetricsConnected
        });
    }, [vm.hasClusters, vm.isMetricsConnected, vm.metrics, vm.selectedCluster]);

    useEffect(() => {
        if (!hasRenderableMetrics) {
            setShouldRenderVisualizations(false);
            return;
        }

        if (shouldRenderVisualizations) {
            return;
        }

        const idleCallbackHandle = createIdleCallbackHandle(() => {
            setShouldRenderVisualizations(true);
        }, 200);

        return () => {
            idleCallbackHandle.cancel();
        };
    }, [hasRenderableMetrics, shouldRenderVisualizations]);

    const shouldShowProgressiveVisualizationLoader = hasRenderableMetrics && !shouldRenderVisualizations;

    return (
        <Container className='clusters-page vh-max color-primary'>
            <Container className='clusters-main d-flex column gap-1-5 w-max'>
                {vm.isLoading && !vm.hasClusters && (
                    <Loader scale={0.5} isFixed={false} />
                )}

                {!vm.isLoading && !vm.hasClusters && <ClustersEmptyState />}

                {metricsUnavailableState && (
                    <RecoveryState
                        title={metricsUnavailableState.title}
                        description={metricsUnavailableState.description}
                        tone={metricsUnavailableState.tone}
                    />
                )}

                {vm.hasClusters && vm.metrics && (
                    <>
                        <MetricsCards metrics={vm.metrics} />

                        {shouldShowProgressiveVisualizationLoader && renderDeferredVisualizationsFallback()}

                        {shouldRenderVisualizations && (
                            <Suspense fallback={renderDeferredVisualizationsFallback()}>
                                <Container className='clusters-grid-equal'>
                                    <ResourceUsage metrics={vm.metrics} />
                                    <CpuDistribution history={vm.history} metrics={vm.metrics} />
                                </Container>

                                <Container className='clusters-grid'>
                                    <Container className='clusters-grid-main'>
                                        <NetworkChart
                                            data={networkData}
                                            isLoading={!vm.metrics}
                                            calculateDelta={false}
                                            title='Network Traffic'
                                            height={300} />
                                    </Container>
                                    <DiskOperations history={vm.history} metrics={vm.metrics} />
                                </Container>
                            </Suspense>
                        )}
                    </>
                )}
            </Container>
        </Container>
    );
};

export default ClusterMonitoringPage;
