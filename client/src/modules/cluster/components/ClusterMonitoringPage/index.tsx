import { Spinner, buttonVariants } from '@heroui/react';
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

/**
 * `.clusters-main`, from the deleted sheet: a centred column that widens its
 * gutters twice. 1440px is not one of Tailwind's screens and there is no theme
 * entry for it, so it stays an arbitrary variant (spec §5).
 */
const MAIN_CLASS = 'flex flex-col gap-6 w-full max-w-[1600px] mx-auto p-4 md:px-8 min-[1440px]:px-12';

/**
 * `.clusters-grid-equal` / `.clusters-grid`. Both were block-level below 768px —
 * the children simply stacked — so the `grid` only turns on at `md:`.
 */
const GRID_EQUAL_CLASS = 'md:grid md:grid-cols-2 md:gap-6 min-[1440px]:gap-8';

const GRID_CLASS = 'md:grid md:grid-cols-2 md:gap-6 lg:grid-cols-3 min-[1440px]:gap-8';

/**
 * `.clusters-empty-state`. `ClustersListing` paints the same panel as its
 * `emptyIcon` and carries its own copy of this literal: it reached this sheet by
 * class name from a file that never imported it, which only worked because both
 * screens happened to be loaded together. A shared constant would be tidier but
 * would drag this whole page module — and its four `lazy` chart chunks — into the
 * listing's graph, so the two literals stay independent.
 */
const EMPTY_STATE_CLASS = 'flex flex-col items-start gap-4 p-6 rounded-2xl border border-border bg-surface-secondary';

/*
 * bravais's `Loader` was twelve orbiting blades sized by an arbitrary `scale`, and
 * `announce` made it a polite live region named by its own visible label. HeroUI's
 * `Spinner` has neither the scale nor the announcement, so the live region moves to
 * the wrapper and the label becomes an ordinary sibling — which is also what makes
 * `reducedMotionLabel` redundant: it existed only because the blades went static
 * and silent, and it repeated `label` verbatim.
 *
 * `min-h-72` is the 18rem that was an inline style; `gap-8` and the label's
 * `text-sm text-muted text-center leading-normal` are bravais's own
 * `.loader-content` / `.loader-label` metrics (its `text-md` is stock `text-sm`,
 * spec §3c).
 */
const renderDeferredVisualizationsFallback = () => (
    <div
        className='flex min-h-72 items-center justify-center p-8'
        role='status'
        aria-live='polite'
        aria-atomic='true'
    >
        <div className='flex flex-col items-center gap-8'>
            <Spinner size='sm' />
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
        /*
         * `.clusters-page` was `overflow: auto; height: 100% !important` beside the
         * element's own `h-dvh`. The `!important` existed to beat that inline pairing,
         * so `h-full!` keeps the same winner and `h-dvh` goes. Its only other rule was
         * a `prefers-reduced-motion` `scroll-behavior: auto`, which `index.css` now
         * declares for the whole document.
         */
        <div className='h-full! overflow-auto text-foreground'>
            <div className={MAIN_CLASS}>
                {vm.isLoading && !vm.hasClusters && (
                    <Spinner />
                )}

                {!vm.isLoading && !vm.hasClusters && (
                    <div className={EMPTY_STATE_CLASS}>
                        <h3 className='text-xl font-semibold text-foreground'>No clusters connected yet</h3>
                        <p className='text-sm text-muted'>
                            Create a team cluster to provision your first compute environment and unlock live metrics on this dashboard.
                        </p>
                        {/*
                          * bravais's `Button to=` rendered a router link styled as a
                          * button; HeroUI's `Button` has no `to`, so this is the app's
                          * existing idiom (shared/ui `NotFoundState`, `ErrorPage`):
                          * a real `<Link>` wearing `buttonVariants`.
                          */}
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
                                <div className={GRID_EQUAL_CLASS}>
                                    <ResourceUsage metrics={vm.metrics} />
                                    <CpuDistribution history={vm.history} metrics={vm.metrics} />
                                </div>

                                <div className={GRID_CLASS}>
                                    {/* `.clusters-grid-main { grid-column: span 2 }` only
                                      * ever applied inside the 1024px rule that made the
                                      * grid three columns wide. */}
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
