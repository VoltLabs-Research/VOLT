import RunRow from '@/modules/analysis/components/AnalysisPage/RunRow';
import MethodMenu from '@/modules/analysis/components/AnalysisPage/MethodMenu';
import TrajectoryPicker from '@/modules/trajectory/components/TrajectoryPicker';
import { analysisQuery } from '@/modules/analysis/hooks/queries';
import { RUN_LISTING_ROWS_KEYS } from '@/modules/analysis/hooks/use-run-listing-rows';
import { resolveAnalysisPluginId } from '@/modules/analysis/utils/resolve-plugin-id';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { SOCKET_ANALYSIS_EVENTS } from '@/modules/socket/events/analysis';
import useSocketQueryInvalidation from '@/modules/socket/hooks/use-socket-query-invalidation';
import useDebouncedValue from '@/shared/ui/hooks/use-debounced-value';
import { Button, Skeleton } from '@heroui/react';
import { ExternalLink, FlaskConical, Search, SearchX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { MethodOption } from '@/modules/analysis/components/AnalysisPage/MethodMenu';

const INVALIDATION_RULES = [
    SOCKET_ANALYSIS_EVENTS.CREATED,
    SOCKET_ANALYSIS_EVENTS.STATUS_CHANGED,
    SOCKET_ANALYSIS_EVENTS.DELETED
].map((event) => ({
    event,
    queryKeys: [analysisQuery.QUERY_KEYS.infiniteLists(), RUN_LISTING_ROWS_KEYS.prefix()]
}));

interface TrajectoryGroup {
    trajectoryId: string;
    name: string;
    runs: Analysis[];
}

const EmptyState = ({ icon, title, action }: { icon: React.ReactNode; title: string; action?: React.ReactNode }) => (
    <div className='flex flex-col items-center gap-2 px-5 py-16 text-center text-muted'>
        <span className='mb-1.5 grid size-11 place-items-center rounded-full bg-foreground/5 text-foreground'>{icon}</span>
        <b className='text-sm font-medium text-foreground'>{title}</b>
        {action && <div className='mt-2.5 flex gap-2'>{action}</div>}
    </div>
);

/*
 * Analysis: every run of the team, newest first, grouped by trajectory. A row is one run (method, its
 * headline, when) and opens the run's report.
 */
const RUNS_PAGE_LIMIT = 20;

const AnalysisPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const trajectoryId = searchParams.get('trajectory');
    const methodId = searchParams.get('method');
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebouncedValue(search.trim(), 300);
    const [trajectoryLabel, setTrajectoryLabel] = useState<string | undefined>();
    const { plugins, pluginsById } = usePluginSelectors();
    const sentinelRef = useRef<HTMLDivElement>(null);

    useSocketQueryInvalidation(INVALIDATION_RULES);

    const listQuery = analysisQuery.useInfiniteListQuery(
        // The page and limit here only seed the cache key; the infinite query passes each page's own.
        trajectoryId
            ? { page: 1, limit: RUNS_PAGE_LIMIT, trajectoryId }
            : { page: 1, limit: RUNS_PAGE_LIMIT, search: debouncedSearch || undefined },
        { refetchOnWindowFocus: false }
    );
    const runs = useMemo(() => listQuery.data?.pages.flatMap((page) => page.data) ?? [], [listQuery.data]);

    const setParam = useCallback((key: string, value: string | null) => {
        setSearchParams((current) => {
            const next = new URLSearchParams(current);
            if (value) next.set(key, value);
            else next.delete(key);
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const visibleRuns = useMemo(() => {
        const query = trajectoryId ? debouncedSearch.toLowerCase() : '';
        return runs.filter((run) => (
            (!methodId || resolveAnalysisPluginId(run) === methodId)
            && (!query || `${run.pluginDisplayName} ${run.trajectory?.name ?? ''}`.toLowerCase().includes(query))
        ));
    }, [runs, methodId, trajectoryId, debouncedSearch]);

    const groups = useMemo<TrajectoryGroup[]>(() => {
        const byTrajectory = new Map<string, TrajectoryGroup>();
        visibleRuns.forEach((run) => {
            const id = run.trajectory?._id ?? 'unknown';
            const group = byTrajectory.get(id) ?? { trajectoryId: id, name: run.trajectory?.name ?? 'Untitled trajectory', runs: [] };
            group.runs.push(run);
            byTrajectory.set(id, group);
        });
        return [...byTrajectory.values()];
    }, [visibleRuns]);

    const { methods, otherMethods } = useMemo(() => {
        const counts = new Map<string, number>();
        runs.forEach((run) => {
            const id = resolveAnalysisPluginId(run);
            counts.set(id, (counts.get(id) ?? 0) + 1);
        });
        const nameOf = (id: string) => pluginsById[id]?.modifier?.name
            || runs.find((run) => resolveAnalysisPluginId(run) === id)?.pluginDisplayName
            || 'Analysis';
        const withRuns: MethodOption[] = [...counts.entries()]
            .map(([id, count]) => ({ id, name: nameOf(id), count }))
            .sort((left, right) => left.name.localeCompare(right.name));
        const others: MethodOption[] = plugins
            .filter((plugin) => !counts.has(plugin._id) && (plugin.exposures?.length ?? 0) > 0)
            .map((plugin) => ({ id: plugin._id, name: plugin.modifier?.name || plugin._id, count: 0 }))
            .sort((left, right) => left.name.localeCompare(right.name));
        return { methods: withRuns, otherMethods: others };
    }, [runs, plugins, pluginsById]);

    const withResultsIds = useMemo(() => new Set(runs.map((run) => run.trajectory?._id).filter((id): id is string => Boolean(id))), [runs]);
    const methodLabel = methodId ? [...methods, ...otherMethods].find((method) => method.id === methodId)?.name : undefined;
    const selectedTrajectoryName = trajectoryLabel ?? runs.find((run) => run.trajectory?._id === trajectoryId)?.trajectory?.name;

    const { hasNextPage, isFetchingNextPage, fetchNextPage } = listQuery;
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return undefined;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }, { rootMargin: '400px' });
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const openRun = useCallback((analysisId: string) => navigate(`/dashboard/analysis/${analysisId}`), [navigate]);
    const clearFilters = () => {
        setSearch('');
        setSearchParams({}, { replace: true });
    };

    let body: React.ReactNode;
    if (listQuery.isLoading) {
        body = (
            <div className='flex flex-col gap-3 rounded-xl border border-border p-4'>
                {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className='h-6 w-full rounded-md' />)}
            </div>
        );
    } else if (methodId && !methods.some((method) => method.id === methodId)) {
        body = (
            <div className='rounded-xl border border-border'>
                <EmptyState
                    icon={<FlaskConical size={20} />}
                    title={`${methodLabel ?? 'This method'} has no runs here yet`}
                    action={<Button variant='outline' size='sm' onPress={() => setParam('method', null)}>Show all methods</Button>}
                />
            </div>
        );
    } else if (groups.length === 0) {
        body = (
            <div className='rounded-xl border border-border'>
                {runs.length === 0 && !trajectoryId && !debouncedSearch
                    ? <EmptyState icon={<FlaskConical size={20} />} title='No analyses yet' action={<Button variant='outline' size='sm' onPress={() => navigate('/dashboard/trajectories/list')}>Open trajectories</Button>} />
                    : <EmptyState icon={<SearchX size={20} />} title='No runs match' action={<Button variant='outline' size='sm' onPress={clearFilters}>Clear filters</Button>} />}
            </div>
        );
    } else {
        body = (
            <div className='overflow-hidden rounded-xl border border-border pb-1.5'>
                {groups.map((group, index) => (
                    <section key={group.trajectoryId} aria-label={group.name} className={index ? 'mt-1.5 border-t border-border' : undefined}>
                        <div className='group/header flex min-h-11 items-center gap-2.5 px-4 pb-0.5 pt-2.5'>
                            <h2 className='min-w-0 truncate text-sm font-semibold text-foreground' title={group.name}>{group.name}</h2>
                            <span className='flex-1' />
                            {group.trajectoryId !== 'unknown' && (
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    className='opacity-0 transition-opacity group-hover/header:opacity-100 focus-visible:opacity-100'
                                    onPress={() => navigate(`/canvas/${group.trajectoryId}`)}
                                >
                                    <ExternalLink size={13} aria-hidden='true' />
                                    Open in canvas
                                </Button>
                            )}
                        </div>
                        {group.runs.map((run) => (
                            <RunRow key={run._id} analysis={run} plugin={pluginsById[resolveAnalysisPluginId(run)]} onOpen={openRun} />
                        ))}
                    </section>
                ))}
            </div>
        );
    }

    return (
        <div className='mx-auto flex w-full max-w-7xl flex-col px-6 pb-8 pt-3'>
            <h1 className='mb-6 text-2xl font-semibold tracking-[-0.01em] text-foreground'>Analysis</h1>
            <div className='mb-4 flex flex-wrap items-center gap-2'>
                <label className='flex h-8 w-60 items-center gap-2 rounded-lg border border-border px-2.5 text-muted focus-within:border-foreground/25'>
                    <Search size={14} aria-hidden='true' />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder='Search'
                        aria-label='Search runs'
                        className='min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted'
                    />
                </label>
                <TrajectoryPicker
                    value={trajectoryId}
                    valueLabel={selectedTrajectoryName}
                    withResultsIds={withResultsIds}
                    onChange={(id, name) => {
                        setTrajectoryLabel(name);
                        setParam('trajectory', id);
                    }}
                />
                <MethodMenu
                    value={methodId}
                    valueLabel={methodLabel}
                    methods={methods}
                    otherMethods={otherMethods}
                    onChange={(id) => setParam('method', id)}
                />
            </div>
            {body}
            <div ref={sentinelRef} aria-hidden='true' className='h-px' />
            {isFetchingNextPage && <Skeleton className='mt-3 h-6 w-full rounded-md' />}
        </div>
    );
};

export default AnalysisPage;
