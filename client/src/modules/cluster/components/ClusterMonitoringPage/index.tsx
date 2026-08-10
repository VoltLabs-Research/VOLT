import '@/modules/cluster/components/ClusterMonitoringPage/ClusterMonitoringPage.css';
import { Button, Loader } from '@voltstack/bravais';
import MetricsCards from '@/modules/cluster/components/MetricsCards';
import useClusterMonitoringPage from '@/modules/cluster/hooks/use-cluster-monitoring-page';
import { getClusterMetricsRecoveryState } from '@/modules/cluster/utils/cluster-live-metrics-status';
import RecoveryState from '@/shared/ui/components/RecoveryState';
import { usePageTitle } from '@/shared/ui/hooks/use-page-title';
import { requestIdleCallbackHandle } from '@/shared/ui/utils/idle-callback';
import useTip from '@/shared/tips/use-tip';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';

const CpuDistribution = lazy(() => import('@/modules/cluster/components/CpuDistribution'));
const DiskOperations = lazy(() => import('@/modules/cluster/components/DiskOperations'));
const ResourceUsage = lazy(() => import('@/modules/cluster/components/ResourceUsage'));
const NetworkChart = lazy(() => import('@/shared/ui/components/NetworkChart'));

const DEFERRED_VISUALIZATIONS_IDLE_TIMEOUT_MS = 200;

const renderDeferredVisualizationsFallback = () => (
    <div className='flex items-center justify-center p-8' style={{ minHeight: '18rem' }}>
        <Loader
            scale={0.35}
            isFixed={false}
            label='Loading live charts'
            announce
            reducedMotionLabel='Loading live charts' />
    </div>
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

    const metricsUnavailableState = !vm.hasClusters || vm.metrics
        ? null
        : getClusterMetricsRecoveryState({
            clusterName: vm.selectedCluster?.name ?? 'This cluster',
            isMetricsConnected: vm.isMetricsConnected
        });

    useEffect(() => {
        if (!hasRenderableMetrics) {
            setShouldRenderVisualizations(false);
            return;
        }

        if (shouldRenderVisualizations) {
            return;
        }

        const idleCallbackHandle = requestIdleCallbackHandle(() => {
            setShouldRenderVisualizations(true);
        }, { timeoutMs: DEFERRED_VISUALIZATIONS_IDLE_TIMEOUT_MS });

        return () => {
            idleCallbackHandle.cancel();
        };
    }, [hasRenderableMetrics, shouldRenderVisualizations]);

    const shouldShowProgressiveVisualizationLoader = hasRenderableMetrics && !shouldRenderVisualizations;

    return (
        <div className='clusters-page h-dvh text-foreground'>
            <div className='flex flex-col gap-6 w-full clusters-main'>
                {vm.isLoading && !vm.hasClusters && (
                    <Loader scale={0.5} isFixed={false} />
                )}

                {!vm.isLoading && !vm.hasClusters && (
                    <div className='flex flex-col items-start gap-4 p-6 rounded-2xl clusters-empty-state'>
                        <h3 className='text-xl font-semibold text-foreground'>No clusters connected yet</h3>
                        <p className='text-sm text-muted'>
                            Create a team cluster to provision your first compute environment and unlock live metrics on this dashboard.
                        </p>
                        <Button variant='solid' intent='brand' to='/onboarding/cluster/setup'>Add New Cluster</Button>
                    </div>
                )}

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
                                <div className='clusters-grid-equal'>
                                    <ResourceUsage metrics={vm.metrics} />
                                    <CpuDistribution history={vm.history} metrics={vm.metrics} />
                                </div>

                                <div className='clusters-grid'>
                                    <div className='clusters-grid-main'>
                                        <NetworkChart
                                            data={networkData}
                                            isLoading={!vm.metrics}
                                            calculateDelta={false}
                                            title='Network Traffic'
                                            height={300} />
                                    </div>
                                    <DiskOperations history={vm.history} metrics={vm.metrics} />
                                </div>
                            </Suspense>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default ClusterMonitoringPage;
