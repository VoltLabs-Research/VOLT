import ReportHero from '@/modules/analysis/components/AnalysisReportPage/ReportHero';
import PanelTile from '@/modules/analysis/components/AnalysisReportPage/PanelTile';
import ReportDataTable from '@/modules/analysis/components/AnalysisReportPage/ReportDataTable';
import RunTimeline from '@/modules/analysis/components/AnalysisReportPage/RunTimeline';
import { analysisQuery as analysesQuery, useAnalysisByIdQuery } from '@/modules/analysis/hooks/queries';
import { useRunAllRows } from '@/modules/analysis/hooks/use-run-listing-rows';
import useRetryFailedFrames from '@/modules/analysis/hooks/use-retry-failed-frames';
import { resolveAnalysisPluginId } from '@/modules/analysis/utils/resolve-plugin-id';
import {
    alignSeries,
    buildRunSeries,
    formatMetric,
    formatRunDuration,
    listPanelTables,
    resolveFailedTimesteps,
    resolveRunSettings,
    resolveRunTimesteps,
    toFiniteNumber
} from '@/modules/analysis/utils/run-results';
import useDownloadAnalysisListings from '@/modules/canvas/hooks/use-download-analysis-listings';
import { AnalysisStatus } from '@/modules/fractal/contracts';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import StatusPill from '@/shared/ui/components/StatusPill';
import { confirmDelete } from '@/shared/ui/hooks/use-confirm';
import { showPromise } from '@/shared/ui/hooks/toast';
import { Button, Skeleton, Tooltip, cn } from '@heroui/react';
import { ChevronDown, ChevronRight, Download, ExternalLink, RotateCw, Trash2, TriangleAlert } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { CSSProperties, ReactNode } from 'react';

const MAX_TILES = 4;
const MAX_HERO_METRICS = 3;

const Tile = ({ span, label, children, className, style }: { span: number; label: ReactNode; children: ReactNode; className?: string; style?: CSSProperties }) => (
    <div className={cn('flex min-w-0 flex-col gap-3 rounded-2xl border border-border px-4 pb-4 pt-4', className)} style={{ gridColumn: `span ${span}`, ...style }}>
        <span className='text-xs font-medium text-muted'>{label}</span>
        {children}
    </div>
);

const IconAction = ({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) => (
    <Tooltip>
        <Button variant='ghost' size='sm' isIconOnly aria-label={label} onPress={onPress}>{children}</Button>
        <Tooltip.Content placement='bottom'>{label}</Tooltip.Content>
    </Tooltip>
);

/*
 * One run's report: the headline value with its chart, a bento of what the run stored at the current frame,
 * and the canvas timeline floating at the bottom to move through the frames.
 */
const AnalysisReportPage = () => {
    const { analysisId = '' } = useParams();
    const navigate = useNavigate();
    const { pluginsById } = usePluginSelectors();
    const retryFailedFrames = useRetryFailedFrames();
    const { download: downloadListings } = useDownloadAnalysisListings();
    const { canAccess } = useTeamPermissions();
    const deleteAnalysisMutation = analysesQuery.useDeleteMutation();

    const analysisQuery = useAnalysisByIdQuery(analysisId, {
        enabled: Boolean(analysisId),
        refetchInterval: (query) => (query.state.data?.status === AnalysisStatus.Running ? 5000 : false)
    });
    const analysis = analysisQuery.data;
    const plugin = analysis ? pluginsById[resolveAnalysisPluginId(analysis)] : undefined;
    const { rows, isLoading: rowsLoading } = useRunAllRows(analysisId || undefined);

    const rawSeries = useMemo(() => buildRunSeries(rows), [rows]);
    const timesteps = useMemo(() => resolveRunTimesteps(analysis, rawSeries), [analysis, rawSeries]);
    const series = useMemo(() => (rawSeries ? alignSeries(rawSeries, timesteps) : null), [rawSeries, timesteps]);
    const failedTimesteps = useMemo(() => resolveFailedTimesteps(analysis), [analysis]);
    const panels = useMemo(() => listPanelTables(plugin), [plugin]);

    const [index, setIndex] = useState<number | null>(null);
    const [metricKey, setMetricKey] = useState<string | null>(null);
    const [showAll, setShowAll] = useState(false);

    // Open on the last frame once the run's timesteps are known.
    useEffect(() => {
        if (index === null && timesteps.length > 0 && !rowsLoading) setIndex(timesteps.length - 1);
    }, [index, timesteps.length, rowsLoading]);

    const frame = Math.min(index ?? Math.max(0, timesteps.length - 1), Math.max(0, timesteps.length - 1));
    const timestep = timesteps[frame];
    const frameFailed = timestep !== undefined && failedTimesteps.has(timestep);
    const changeFrame = useCallback((next: number) => setIndex(next), []);

    const heroMetrics = useMemo(() => {
        const changing = series?.metrics.filter((metric) => metric.varies) ?? [];
        return (changing.length ? changing : series?.metrics ?? []).slice(0, MAX_HERO_METRICS);
    }, [series]);
    const tileMetrics = useMemo(() => series?.metrics.slice(0, MAX_TILES) ?? [], [series]);
    const settings = useMemo(() => {
        const list = resolveRunSettings(plugin, analysis);
        const cluster = analysis?.teamCluster && typeof analysis.teamCluster === 'object' && 'name' in analysis.teamCluster
            ? String((analysis.teamCluster as { name?: unknown }).name ?? '')
            : '';
        if (cluster) list.push({ label: 'Cluster', value: cluster });
        const duration = formatRunDuration(analysis);
        if (duration) list.push({ label: 'Duration', value: duration });
        return list;
    }, [plugin, analysis]);

    if (analysisQuery.isLoading) {
        return (
            <div className='mx-auto flex w-full max-w-[1010px] flex-col gap-4 px-6 pb-8 pt-3'>
                <Skeleton className='h-4 w-56 rounded-md' />
                <Skeleton className='h-8 w-80 rounded-lg' />
                <Skeleton className='mt-6 h-64 w-full rounded-2xl' />
            </div>
        );
    }

    if (!analysis) {
        return (
            <div className='mx-auto flex w-full max-w-[1010px] flex-col items-center gap-3 px-6 py-24 text-center'>
                <b className='text-sm font-medium text-foreground'>This analysis is not available</b>
                <Button variant='outline' size='sm' onPress={() => navigate('/dashboard/analysis')}>Back to Analysis</Button>
            </div>
        );
    }

    const trajectoryId = analysis.trajectory?._id;
    const isCompleted = analysis.status === AnalysisStatus.Completed;
    const frameCount = analysis.totalFrames || timesteps.length;
    const when = analysis.finishedAt ?? analysis.createdAt;
    const tileSpan = tileMetrics.length ? 12 / tileMetrics.length : 12;
    const panelRowSpan = panels.length === 1 ? 2 : 1;
    const dataSpan = (panels.length + 2) % 2 ? 12 : 6;
    const columnList = series ? ['Timestep', ...series.metrics.map((metric) => metric.label)].join(', ') : '';
    const failedList = [...failedTimesteps].sort((left, right) => left - right);
    const methodName = analysis.pluginDisplayName || plugin?.modifier?.name || 'analysis';
    const runsPath = trajectoryId ? `/dashboard/analysis?trajectory=${trajectoryId}` : '/dashboard/analysis';

    const deleteRun = async () => {
        const confirmed = await confirmDelete(methodName, `Delete this ${methodName} run on ${analysis.trajectory?.name ?? 'this trajectory'}? Its results are removed with it. This action cannot be undone.`);
        if (!confirmed) return;
        try {
            await showPromise(deleteAnalysisMutation.mutateAsync(analysisId), {
                loading: { title: 'Deleting analysis...' },
                success: { title: 'Analysis deleted' },
                error: { title: 'Failed to delete analysis' }
            });
            navigate(runsPath, { replace: true });
        } catch {
            // The toast already reports the failure; the report stays open.
        }
    };

    return (
        <div className='mx-auto flex w-full max-w-[1010px] flex-col px-6 pb-8 pt-3'>
            <nav aria-label='Breadcrumb' className='flex items-center gap-1.5 text-xs text-muted'>
                <Link to='/dashboard/analysis' className='hover:text-foreground'>Analysis</Link>
                <ChevronRight size={12} aria-hidden='true' />
                {trajectoryId
                    ? <Link to={runsPath} className='truncate hover:text-foreground'>{analysis.trajectory?.name}</Link>
                    : <span className='truncate'>{analysis.trajectory?.name}</span>}
            </nav>

            <header className='mt-1.5 flex items-start justify-between gap-5'>
                <div className='min-w-0'>
                    <h1 className='truncate text-2xl font-semibold tracking-[-0.01em] text-foreground'>{methodName}</h1>
                    <div className='mt-1 flex flex-wrap items-center gap-2 text-sm text-muted'>
                        {!isCompleted && <StatusPill status={analysis.status} />}
                        <span>{frameCount} frame{frameCount === 1 ? '' : 's'}{when ? ` · ${formatDistanceToNowStrict(new Date(when), { addSuffix: true })}` : ''}</span>
                    </div>
                </div>
                <div className='flex shrink-0 items-center gap-0.5'>
                    <IconAction label='Download listings' onPress={() => void downloadListings({ analysisId })}>
                        <Download size={15} aria-hidden='true' />
                    </IconAction>
                    {canAccess(['analysis:delete']) && (
                        <IconAction label='Delete run' onPress={() => void deleteRun()}>
                            <Trash2 size={15} aria-hidden='true' />
                        </IconAction>
                    )}
                    {trajectoryId && (
                        <Button variant='primary' size='sm' className='ml-1.5' onPress={() => navigate(`/canvas/${trajectoryId}?analysisId=${encodeURIComponent(analysisId)}`)}>
                            <ExternalLink size={14} aria-hidden='true' />
                            Open in canvas
                        </Button>
                    )}
                </div>
            </header>

            {failedList.length > 0 && (
                <div role='alert' className='mt-4 flex flex-wrap items-center gap-2.5 rounded-2xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger-soft-foreground'>
                    <TriangleAlert size={15} aria-hidden='true' />
                    <span className='flex-1'>
                        {failedList.length === 1 ? 'Timestep' : 'Timesteps'} {failedList.slice(0, 6).map((value) => value.toLocaleString('en-US')).join(', ')}{failedList.length > 6 ? '…' : ''} failed
                    </span>
                    {canAccess(['analysis:update']) && (
                        <Button variant='outline' size='sm' onPress={() => void retryFailedFrames(analysisId)}>
                            <RotateCw size={13} aria-hidden='true' />
                            Retry failed frames
                        </Button>
                    )}
                </div>
            )}

            {rowsLoading && !series ? (
                <Skeleton className='mt-6 h-[320px] w-full rounded-2xl' />
            ) : series && heroMetrics.length > 0 ? (
                <ReportHero
                    series={series}
                    metrics={heroMetrics}
                    metricKey={metricKey ?? heroMetrics[0].key}
                    onMetricChange={setMetricKey}
                    index={frame}
                    onIndexChange={changeFrame}
                />
            ) : (
                <p className='mt-6 text-sm text-muted'>
                    {isCompleted ? 'This run stored no listing values.' : 'Values appear here as frames finish.'}
                </p>
            )}

            <div className='mt-8 grid grid-cols-12 gap-3 [grid-auto-flow:row_dense]'>
                {series && tileMetrics.map((metric) => (
                    <Tile key={metric.key} span={tileSpan} label={metric.label}>
                        <span className='mt-auto whitespace-nowrap text-3xl font-light leading-[1.1] tracking-[-0.02em] tabular-nums text-foreground'>
                            {frameFailed ? '—' : formatMetric(toFiniteNumber(series.rows[frame]?.[metric.key]))}
                        </span>
                    </Tile>
                ))}
                {panels.map((panel) => (
                    <PanelTile
                        key={`${panel.exposureId}:${panel.table.source}`}
                        analysisId={analysisId}
                        panel={panel}
                        timestep={timestep}
                        failed={frameFailed}
                        rowSpan={panelRowSpan}
                    />
                ))}
                {settings.length > 0 && (
                    <Tile span={6} label='Settings'>
                        <dl className='m-0 grid grid-cols-2 gap-x-4 gap-y-3.5'>
                            {settings.map((setting) => (
                                <div key={setting.label} className='min-w-0'>
                                    <dt className='truncate text-2xs text-muted' title={setting.label}>{setting.label}</dt>
                                    <dd className='m-0 mt-0.5 truncate text-sm tabular-nums text-foreground' title={setting.value}>{setting.value}</dd>
                                </div>
                            ))}
                        </dl>
                    </Tile>
                )}
                {series && (
                    // items-stretch: Electron's Chromium starts a button's children at flex-start, so the
                    // column list would size to its text and never reach its ellipsis.
                    <button
                        type='button'
                        aria-expanded={showAll}
                        onClick={() => setShowAll((current) => !current)}
                        className='relative flex min-w-0 cursor-pointer flex-col items-stretch gap-3 rounded-2xl border border-border bg-transparent px-4 pb-4 pt-4 text-left transition-colors duration-150 hover:bg-foreground/[0.04]'
                        style={{ gridColumn: `span ${settings.length > 0 ? dataSpan : 12}` }}
                    >
                        <span className='text-xs font-medium text-muted'>All data</span>
                        <ChevronDown size={16} className={cn('absolute right-4 top-4 text-muted transition-transform', showAll && 'rotate-180')} aria-hidden='true' />
                        <span className='mt-auto text-3xl font-light leading-[1.1] tracking-[-0.02em] tabular-nums text-foreground'>
                            {series.timesteps.length}
                            <small className='ml-1 text-sm font-normal tracking-normal text-muted'>{series.timesteps.length === 1 ? 'row' : 'rows'}</small>
                        </span>
                        <span className='truncate text-xs text-muted' title={columnList}>{columnList}</span>
                    </button>
                )}
                {series && showAll && (
                    <div className='rounded-2xl border border-border px-2 py-1.5' style={{ gridColumn: 'span 12' }}>
                        <ReportDataTable series={series} index={frame} onIndexChange={changeFrame} failedTimesteps={failedTimesteps} />
                    </div>
                )}
            </div>

            {timesteps.length > 1 && (
                <RunTimeline timesteps={timesteps} index={frame} onIndexChange={changeFrame} failedTimesteps={failedTimesteps} />
            )}
        </div>
    );
};

export default AnalysisReportPage;
