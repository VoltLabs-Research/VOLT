import '@/modules/cluster/components/ClusterMonitoringPage/ClusterMonitoringPage.css';
import { Button, Heading, Text, Box, Loader, Stack } from '@voltstack/bravais';
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
    <Box display='flex' align='center' justify='center' p='2' style={{ minHeight: '18rem' }}>
        <Loader
            scale={0.35}
            isFixed={false}
            label='Loading live charts'
            announce
            reducedMotionLabel='Loading live charts' />
    </Box>
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
        <Box className='clusters-page vh-max color-primary'>
            <Stack gap='1-5' width='max' className='clusters-main'>
                {vm.isLoading && !vm.hasClusters && (
                    <Loader scale={0.5} isFixed={false} />
                )}

                {!vm.isLoading && !vm.hasClusters && (
                    <Stack align='start' gap='1' p='1-5' radius='lg' className='clusters-empty-state'>
                        <Heading level={3} size='xl' weight='bold'>No clusters connected yet</Heading>
                        <Text as='p' size='md' tone='secondary'>
                            Create a team cluster to provision your first compute environment and unlock live metrics on this dashboard.
                        </Text>
                        <Button variant='solid' intent='brand' to='/onboarding/cluster/setup'>Add New Cluster</Button>
                    </Stack>
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
                                <Box className='clusters-grid-equal'>
                                    <ResourceUsage metrics={vm.metrics} />
                                    <CpuDistribution history={vm.history} metrics={vm.metrics} />
                                </Box>

                                <Box className='clusters-grid'>
                                    <Box className='clusters-grid-main'>
                                        <NetworkChart
                                            data={networkData}
                                            isLoading={!vm.metrics}
                                            calculateDelta={false}
                                            title='Network Traffic'
                                            height={300} />
                                    </Box>
                                    <DiskOperations history={vm.history} metrics={vm.metrics} />
                                </Box>
                            </Suspense>
                        )}
                    </>
                )}
            </Stack>
        </Box>
    );
};

export default ClusterMonitoringPage;
