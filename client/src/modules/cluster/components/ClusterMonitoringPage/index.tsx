import Loader from '@/shared/ui/components/Loader';
import { buttonVariants } from '@heroui/react';
import MetricsCards from '@/modules/cluster/components/MetricsCards';
import useClusterMonitoringPage from '@/modules/cluster/hooks/use-cluster-monitoring-page';
import { getClusterMetricsRecoveryState } from '@/modules/cluster/utils/cluster-live-metrics-status';
import RecoveryState from '@/shared/ui/components/RecoveryState';
import { usePageTitle } from '@/shared/ui/hooks/use-page-title';
import { requestIdleCallbackHandle } from '@/shared/ui/utils/idle-callback';
import useTip from '@/shared/tips/use-tip';
import { Link } from 'react-router-dom';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';

const CpuDistribution = lazy(() => import('@/modules/cluster/components/CpuDistribution'));
const DiskOperations = lazy(() => import('@/modules/cluster/components/DiskOperations'));
const ResourceUsage = lazy(() => import('@/modules/cluster/components/ResourceUsage'));
const NetworkChart = lazy(() => import('@/shared/ui/components/NetworkChart'));

const DEFERRED_VISUALIZATIONS_IDLE_TIMEOUT_MS = 200;

const renderDeferredVisualizationsFallback = () => (
    <div
        className='flex min-h-72 items-center justify-center p-8'
        role='status'
        aria-live='polite'
        aria-atomic='true'
    >
        <div className='flex flex-col items-center gap-8'>
            <Loader size='sm' />
            <span className='text-sm text-muted text-center leading-normal'>Loading live charts</span>
        </div>
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

        <div className='h-full! overflow-auto text-foreground'>
            <div className='flex flex-col gap-6 w-full max-w-[1600px] mx-auto p-4 md:px-8 min-[1440px]:px-12'>
                {vm.isLoading && !vm.hasClusters && (
                    <Loader />
                )}

                {!vm.isLoading && !vm.hasClusters && (
                    <div className='flex flex-col items-start gap-4 p-6 rounded-xl border border-border bg-surface-secondary'>
                        <h3 className='text-xl font-semibold text-foreground'>No clusters connected yet</h3>
                        <p className='text-sm text-muted'>
                            Create a team cluster to provision your first compute environment and unlock live metrics on this dashboard.
                        </p>
                        <Link
                            to='/onboarding/cluster/setup'
                            className={buttonVariants({ variant: 'primary' })}
                        >
                            Add New Cluster
                        </Link>
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
                                <div className='md:grid md:grid-cols-2 md:gap-6 min-[1440px]:gap-8'>
                                    <ResourceUsage metrics={vm.metrics} />
                                    <CpuDistribution history={vm.history} metrics={vm.metrics} />
                                </div>
                                <div className='md:grid md:grid-cols-2 md:gap-6 lg:grid-cols-3 min-[1440px]:gap-8'>
                                    <div className='lg:col-span-2'>
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
