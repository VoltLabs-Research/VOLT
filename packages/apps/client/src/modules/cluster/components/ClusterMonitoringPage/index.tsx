import { useSingleTenant } from '@/modules/system/hooks/use-single-tenant';
import { Skeleton, buttonVariants } from '@heroui/react';
import useClusterMonitoringPage from './use-cluster-monitoring-page';
import { getClusterMetricsRecoveryState } from '@/modules/cluster/utils/cluster-live-metrics-status';
import RecoveryState from '@/shared/ui/components/RecoveryState';
import { usePageTitle } from '@/shared/ui/hooks/use-page-title';
import { requestIdleCallbackHandle } from '@/shared/ui/utils/idle-callback';
import useTip from '@/shared/tips/use-tip';
import { Link } from 'react-router-dom';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import Scrollable from '@/shared/ui/components/Scrollable';

const ClusterResourceReadout = lazy(() => import('@/modules/cluster/components/ClusterResourceReadout'));
const CpuDistribution = lazy(() => import('@/modules/cluster/components/CpuDistribution'));
const DiskOperations = lazy(() => import('@/modules/cluster/components/DiskOperations'));
const NetworkChart = lazy(() => import('@/shared/ui/components/NetworkChart'));

const DEFERRED_VISUALIZATIONS_IDLE_TIMEOUT_MS = 200;

// A chart card (ChartContainer) while it loads: its title above the chart area.
const ChartCardSkeleton = () => (
    <section className='flex min-w-0 flex-col gap-6 rounded-2xl bg-foreground/4 p-6 max-sm:p-5'>
        <span className='flex h-6 items-center'>
            <Skeleton className='h-3.5 w-32 rounded-md' />
        </span>
        <Skeleton className='h-70 w-full rounded-2xl' />
    </section>
);

const RESOURCE_ROW_KEYS = ['cpu', 'memory', 'disk', 'network'];

// The page while its metrics or charts load, in the order it renders them: the resource readout
// (CPU, memory, disk, network), the CPU distribution, then network traffic beside disk operations.
const renderMonitoringSkeleton = () => (
    <div className='flex flex-col gap-4' role='status' aria-label='Loading live charts'>
        <div className='divide-y divide-foreground/6 rounded-2xl bg-foreground/4'>
            {RESOURCE_ROW_KEYS.map((key) => (
                <div className='flex flex-row items-center gap-6 px-5 py-4' key={key}>
                    <div className='flex flex-col gap-0.5 md:w-64 md:shrink-0'>
                        <span className='flex h-6 items-center'>
                            <Skeleton className='h-3.5 w-20 rounded-md' />
                        </span>
                        <span className='flex h-5 items-center'>
                            <Skeleton className='h-2.5 w-44 rounded-md' />
                        </span>
                    </div>
                    <Skeleton className='h-8 min-w-24 flex-1 rounded-md max-md:hidden' />
                    <Skeleton className='ms-auto h-5 w-16 shrink-0 rounded-md' />
                </div>
            ))}
        </div>
        <ChartCardSkeleton />
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <ChartCardSkeleton />
            <ChartCardSkeleton />
        </div>
    </div>
);

const ClusterMonitoringPage = () => {
    const singleTenant = useSingleTenant();
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
        <Scrollable className='h-full! text-foreground'>
            <div className='flex min-h-full flex-col gap-4 w-full max-w-[1600px] mx-auto p-4 md:px-8 min-[1440px]:px-12'>
                {vm.isLoading && !vm.hasClusters && renderMonitoringSkeleton()}

                {!vm.isLoading && !vm.hasClusters && (
                    <div className='flex min-h-72 flex-1 flex-col items-center justify-center gap-4 text-center'>
                        <div className='flex flex-col gap-2'>
                            <h1 className='text-base font-medium text-foreground'>No clusters connected yet</h1>
                            <p className='max-w-sm text-sm text-muted'>
                            {singleTenant
                                ? 'The local compute daemon has not connected yet. Live metrics appear here as soon as it does.'
                                : 'Create a team cluster to provision your first compute environment and unlock live metrics on this dashboard.'}
                            </p>
                        </div>
                        {!singleTenant && (
                            <Link
                                to='/onboarding/cluster/setup'
                                className={buttonVariants({ variant: 'primary', size: 'sm' })}
                            >
                                Add New Cluster
                            </Link>
                        )}
                    </div>
                )}

                {metricsUnavailableState && (
                    <RecoveryState
                        title={metricsUnavailableState.title}
                        description={metricsUnavailableState.description}
                        tone={metricsUnavailableState.tone}
                        className='flex-1'
                    />
                )}

                {vm.hasClusters && vm.metrics && (
                    <>
                        {shouldShowProgressiveVisualizationLoader && renderMonitoringSkeleton()}

                        {shouldRenderVisualizations && (
                            <Suspense fallback={renderMonitoringSkeleton()}>
                                <ClusterResourceReadout metrics={vm.metrics} history={vm.history} />

                                <CpuDistribution history={vm.history} metrics={vm.metrics} />

                                <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                                    <NetworkChart
                                        data={networkData}
                                        isLoading={!vm.metrics}
                                        calculateDelta={false}
                                        title='Network Traffic'
                                        height={260} />
                                    <DiskOperations history={vm.history} metrics={vm.metrics} />
                                </div>
                            </Suspense>
                        )}
                    </>
                )}
            </div>
        </Scrollable>
    );
};

export default ClusterMonitoringPage;
