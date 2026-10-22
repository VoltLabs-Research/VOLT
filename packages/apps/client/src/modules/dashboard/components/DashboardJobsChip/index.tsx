import JobsHistoryViewer from '@/modules/jobs/components/JobsHistoryViewer';
import useJobStatusCounts from '@/modules/canvas/hooks/use-job-status-counts';
import useWorkspaceStatus, { CRITICAL_CPU_THRESHOLD } from '@/modules/dashboard/hooks/use-workspace-status';
import { formatNetworkSpeed } from '@/modules/cluster/utils/format-network';
import { localStackMode } from '@/modules/local-stack/services/local-stack-mode';
import { useSingleTenant } from '@/modules/system/hooks/use-single-tenant';
import Scrollable from '@/shared/ui/components/Scrollable';
import { PopoverContent, PopoverDialog, PopoverRoot, PopoverTrigger, ProgressCircle, Separator, cn } from '@heroui/react';
import { Activity, Check, Clock, Cpu, HardDrive, MemoryStick, Play, Server, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

const METER_STEPS = [1, 2, 3, 4, 5] as const;
const METER_STEP_HEIGHTS = ['h-[30%]', 'h-[47%]', 'h-[64%]', 'h-[82%]', 'h-full'] as const;

// One-line rows in the 24px popover, inset 6px: concentric, which makes them pills.
const POPOVER_ROW_CLASS = 'flex min-h-9 w-full items-center gap-2.5 rounded-full px-2.5 py-1.5 text-base text-foreground transition-colors duration-150 hover:bg-foreground/6';

interface UsageMeterProps {
    percent: number;
}

const UsageMeter = ({ percent }: UsageMeterProps) => {
    const lit = Math.max(1, Math.round(percent / 20));
    let litClass = 'bg-foreground';
    if (percent >= CRITICAL_CPU_THRESHOLD) {
        litClass = 'bg-danger';
    } else if (percent >= 60) {
        litClass = 'bg-warning';
    }

    return (
        <span className='inline-flex h-3.5 items-end gap-0.5' aria-hidden='true'>
            {METER_STEPS.map((step, index) => (
                <span
                    key={step}
                    className={cn('w-[3px] rounded-full', METER_STEP_HEIGHTS[index], step <= lit ? litClass : 'bg-foreground/15')}
                />
            ))}
        </span>
    );
};

interface MetricTileProps {
    icon: LucideIcon;
    label: string;
    children: ReactNode;
}

const MetricTile = ({ icon: Icon, label, children }: MetricTileProps) => (
    <div className='flex flex-col gap-1.5 rounded-xl bg-foreground/4 px-3 py-2.5'>
        <span className='flex items-center gap-1.5 text-xs text-muted'>
            <Icon className='size-3.5' aria-hidden='true' />
            {label}
        </span>
        <span className='flex items-baseline justify-between gap-2 text-lg font-semibold tabular-nums'>
            {children}
        </span>
    </div>
);

interface JobsStatusProps {
    counts: ReturnType<typeof useJobStatusCounts>;
    onNavigate: () => void;
}

// What the bottom bar used to show: the jobs of every trajectory, the clusters' load and who is online.
const JobsStatus = ({ counts, onNavigate }: JobsStatusProps) => {
    const singleTenant = useSingleTenant();
    const { clusterMetrics, presence } = useWorkspaceStatus();
    const showPresence = !singleTenant && presence.total > 0;
    const showClustersLink = !localStackMode.isEnabled();

    const countItems: Array<[LucideIcon, string, number]> = [
        [Clock, 'Queued', counts.queued],
        [Play, 'Running', counts.running],
        [Check, 'Done', counts.completed],
        [X, 'Failed', counts.failed]
    ];

    return (
        <>
            <div className='flex items-center justify-between gap-3 px-2.5 pt-2 pb-1.5'>
                <h2 className='text-base font-medium'>Compute jobs</h2>
                <span className='text-xs text-muted'>All trajectories</span>
            </div>

            <div className='flex flex-wrap items-center gap-3 px-2.5 pb-1 text-xs text-muted'>
                {countItems.map(([Icon, label, count]) => (
                    <span key={label} className='flex items-center gap-1'>
                        <Icon className='size-3.5' aria-hidden='true' />
                        <span className='tabular-nums text-foreground'>{count}</span>
                        {label}
                    </span>
                ))}
            </div>

            <Scrollable className='min-h-0 flex-1 py-1.5'>
                <JobsHistoryViewer />
            </Scrollable>

            {clusterMetrics && (
                <>
                    <Separator className='mx-1.5 my-1 w-auto bg-foreground/6' />
                    <section className='flex flex-col gap-2 px-2.5 py-2' aria-label='Clusters'>
                        <span className='text-xs text-muted'>Clusters</span>
                        <div className='grid grid-cols-2 gap-2'>
                            <MetricTile icon={Cpu} label='CPU'>
                                <span className={cn(clusterMetrics.hasCritical && 'text-danger')}>{clusterMetrics.avgCpu}%</span>
                                <UsageMeter percent={clusterMetrics.avgCpu} />
                            </MetricTile>
                            <MetricTile icon={MemoryStick} label='Memory'>
                                {clusterMetrics.avgMemory}%
                                <UsageMeter percent={clusterMetrics.avgMemory} />
                            </MetricTile>
                            <MetricTile icon={HardDrive} label='Disk'>
                                {clusterMetrics.avgDisk}%
                                <UsageMeter percent={clusterMetrics.avgDisk} />
                            </MetricTile>
                            <MetricTile icon={Activity} label='Network'>
                                <span className='flex flex-col text-sm whitespace-nowrap'>
                                    <span>↓ {formatNetworkSpeed(clusterMetrics.incoming)}</span>
                                    <span>↑ {formatNetworkSpeed(clusterMetrics.outgoing)}</span>
                                </span>
                            </MetricTile>
                        </div>
                    </section>
                </>
            )}

            {(showPresence || showClustersLink) && <Separator className='mx-1.5 my-1 w-auto bg-foreground/6' />}

            {showPresence && (
                <Link to='/dashboard/my-team' className={POPOVER_ROW_CLASS} onClick={onNavigate}>
                    <span
                        className={cn('size-2 shrink-0 rounded-full', presence.online > 0 ? 'bg-success ring-3 ring-success/25' : 'bg-muted')}
                        aria-hidden='true'
                    />
                    <span className='tabular-nums'>{presence.online} / {presence.total} online</span>
                    <span className='ml-auto text-xs text-muted'>My Team</span>
                </Link>
            )}

            {showClustersLink && (
                <Link to='/dashboard/clusters' className={POPOVER_ROW_CLASS} onClick={onNavigate}>
                    <Server className='size-4 text-muted' aria-hidden='true' />
                    Open clusters
                </Link>
            )}
        </>
    );
};

// The compute jobs in the header: a ring of how many are done, and the jobs and clusters behind it.
const DashboardJobsChip = () => {
    const [isOpen, setIsOpen] = useState(false);
    const counts = useJobStatusCounts();
    const total = counts.queued + counts.running + counts.completed + counts.failed;
    const donePercent = total === 0 ? 0 : Math.round((counts.completed / total) * 100);

    let label = 'Jobs';
    if (counts.running > 0) {
        label = `${counts.running} running`;
    } else if (counts.queued > 0) {
        label = `${counts.queued} queued`;
    }

    return (
        <PopoverRoot isOpen={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger<'button'>
                type='button'
                className='inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-foreground/8 bg-transparent pr-2.5 pl-1.5 text-sm font-medium tabular-nums text-foreground transition-colors duration-150 hover:bg-foreground/6 aria-expanded:bg-foreground/6 max-sm:w-9 max-sm:justify-center max-sm:px-0'
                aria-label={`Compute jobs: ${label}`}
                render={(triggerProps) => <button {...triggerProps} />}
            >
                <span className='relative flex size-5 items-center justify-center'>
                    <ProgressCircle
                        aria-hidden='true'
                        value={donePercent}
                        size='sm'
                        color='default'
                        className='absolute inset-0 [--progress-circle-track-stroke:color-mix(in_oklab,var(--foreground)_10%,transparent)]'
                    >
                        <ProgressCircle.Track>
                            <ProgressCircle.TrackCircle />
                            <ProgressCircle.FillCircle />
                        </ProgressCircle.Track>
                    </ProgressCircle>
                    <Cpu className='size-3 text-muted' aria-hidden='true' />
                </span>
                <span className='max-sm:sr-only'>{label}</span>
            </PopoverTrigger>
            <PopoverContent placement='bottom end' className='w-[23rem] max-w-[calc(100vw-1rem)]'>
                <PopoverDialog aria-label='Compute jobs' className='flex max-h-[min(40rem,calc(100dvh-5rem))] flex-col p-1.5'>
                    <JobsStatus counts={counts} onNavigate={() => setIsOpen(false)} />
                </PopoverDialog>
            </PopoverContent>
        </PopoverRoot>
    );
};

export default DashboardJobsChip;
