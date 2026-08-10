import { Separator, cn } from '@heroui/react';
import { openModal } from '@/shared/ui/modal';
import StatusCounts from '@/modules/canvas/components/StatusCounts';
import useJobStatusCounts from '@/modules/canvas/hooks/use-job-status-counts';
import useClusterManagement from '@/modules/cluster/hooks/use-cluster-management';
import useClusterMetrics from '@/modules/cluster/hooks/use-cluster-metrics';
import { resolveClusterMetricId } from '@/modules/cluster/utils/resolve-cluster-metric-id';
import { formatNetworkSpeed } from '@/modules/cluster/utils/format-network';
import useTeamMemberData from '@/modules/team/hooks/member/use-team-member-data';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { useSingleTenant } from '@/modules/system/hooks/use-single-tenant';
import { useTeamPresenceStore } from '@/modules/team/store/team/use-team-presence-store';
import { resolveTeamUserOnline } from '@/modules/team/utils/member/presence';
import { DASHBOARD_DRAWER_IDS, useJobsDrawerStore } from '@/modules/dashboard/store/use-jobs-drawer-store';
import { useMemo } from 'react';
import { ArrowDown, ArrowUp, Cpu, HardDrive, MemoryStick, Users } from 'lucide-react';
import type { ReactNode } from 'react';

const CRITICAL_CPU_THRESHOLD = 85;

/**
 * `.dashboard-bottom-bar` composed with the `.glass-bg` it used to sit under.
 *
 * The sheet's `.dashboard-bottom-bar.glass-bg { background: var(--color-bg);
 * border: 0; box-shadow: none }` was a deliberate double-class specificity hack —
 * its own comment said so — to cancel the glass surface and pin the bar to the app
 * background so it read as a flush extension of the chrome. With `.glass-bg` gone
 * the hack has nothing to beat, and the intent is just `bg-background` with no
 * border. So the `bg-surface border border-border` the codemod left on the element
 * is dropped rather than kept: keeping it would newly draw a border the bar has
 * never had.
 */
const BOTTOM_BAR = 'shrink-0 bg-background';

/**
 * `.dashboard-bottom-bar-segment`. `--radius-sm` is 8px → `rounded-lg` (spec §3b),
 * and `--accent-blue` is the monochrome accent, which `--focus` already resolves to.
 */
const SEGMENT = 'inline-flex h-full cursor-pointer items-center gap-[0.85rem] whitespace-nowrap rounded-lg border-0 bg-transparent px-3 text-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--focus)]';

const SEGMENT_ICON = 'inline-flex items-center text-muted';

/**
 * `.dashboard-bottom-bar-divider`. bravais's Divider painted a 1px box with a
 * BACKGROUND rather than a border, and its vertical variant carried no
 * `flex-shrink: 0` — inside this scrolling row it was compressible to nothing.
 * HeroUI's `Separator` is a real `role='separator'` hairline, so the height is all
 * that has to be restated.
 */
const DIVIDER = 'h-[18px] self-center';

/** `.dashboard-bottom-bar-presence-dot`. */
const PRESENCE_DOT = 'inline-block size-1.5 rounded-full mr-[0.35rem] align-middle';

interface BottomBarSegmentProps {
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    children: ReactNode;
}

const BottomBarSegment = ({ label, icon, onClick, children }: BottomBarSegmentProps) => (
    <button
        type='button'
        className={SEGMENT}
        onClick={onClick}
        aria-label={`Open ${label}`}
    >
        {icon && <span className={SEGMENT_ICON} aria-hidden='true'>{icon}</span>}
        {children}
    </button>
);

interface BottomBarMetricProps {
    icon: ReactNode;
    value: string;
    critical?: boolean;
}

const BottomBarMetric = ({ icon, value, critical }: BottomBarMetricProps) => (
    <span className='flex flex-row items-center gap-1'>
        <span className={SEGMENT_ICON} aria-hidden='true'>{icon}</span>
        {/* The sheet needed `!important` to beat `.text-muted`; `cn` is tailwind-merge
            aware, so the later colour simply wins. */}
        <span className={cn('text-xs text-muted', critical && 'text-danger')}>
            {value}
        </span>
    </span>
);

const DashboardBottomBar = () => {
    const selectedTeam = useSelectedTeam();
    const singleTenant = useSingleTenant();
    const setJobsScope = useJobsDrawerStore((state) => state.setScope);

    const jobCounts = useJobStatusCounts();

    const clusterManagement = useClusterManagement();
    const { clusters: liveClusters, isConnected } = useClusterMetrics();
    const teamClusters = clusterManagement.clusters;

    const clusterMetrics = useMemo(() => {
        const metricsByClusterId = new Map(liveClusters.map((cluster) => [resolveClusterMetricId(cluster), cluster]));
        let cpuSum = 0;
        let memorySum = 0;
        let diskSum = 0;
        let incomingSum = 0;
        let outgoingSum = 0;
        let samples = 0;
        let hasCritical = false;

        for (const teamCluster of teamClusters) {
            const liveMetrics = isConnected ? metricsByClusterId.get(teamCluster._id) ?? null : null;
            if (!liveMetrics) {
                continue;
            }

            cpuSum += liveMetrics.cpu.usage;
            memorySum += liveMetrics.memory.usagePercent;
            diskSum += liveMetrics.disk.usagePercent;
            incomingSum += liveMetrics.network.incoming;
            outgoingSum += liveMetrics.network.outgoing;
            samples += 1;

            if (liveMetrics.cpu.usage >= CRITICAL_CPU_THRESHOLD) {
                hasCritical = true;
            }
        }

        if (samples === 0) {
            return null;
        }

        return {
            avgCpu: Math.round(cpuSum / samples),
            avgMemory: Math.round(memorySum / samples),
            avgDisk: Math.round(diskSum / samples),
            incoming: incomingSum,
            outgoing: outgoingSum,
            hasCritical
        };
    }, [teamClusters, liveClusters, isConnected]);

    const { members } = useTeamMemberData({ teamId: selectedTeam?._id });
    const onlineUserIds = useTeamPresenceStore((s) => s.onlineUserIds);
    const hasPresenceSnapshot = useTeamPresenceStore((s) => s.hasPresenceSnapshot);

    const presenceCounts = useMemo(() => {
        let online = 0;
        for (const member of members) {
            if (resolveTeamUserOnline(member.user, onlineUserIds, hasPresenceSnapshot)) {
                online += 1;
            }
        }
        return {
            online,
            total: members.length
        };
    }, [members, onlineUserIds, hasPresenceSnapshot]);

    const showClusters = clusterMetrics !== null;
    const showPresence = !singleTenant && presenceCounts.total > 0;

    const openJobsDrawer = () => {
        setJobsScope({ trajectoryId: null });
        openModal(DASHBOARD_DRAWER_IDS.jobs);
    };

    return (
        <footer className={BOTTOM_BAR} aria-label='Workspace status'>
            <div className='flex flex-row items-center gap-2 h-9 overflow-x-auto overscroll-x-contain px-3'>
                <BottomBarSegment label='compute jobs' onClick={openJobsDrawer}>
                    <StatusCounts
                        queued={jobCounts.queued}
                        running={jobCounts.running}
                        completed={jobCounts.completed}
                        failed={jobCounts.failed}
                    />
                </BottomBarSegment>

                {showClusters && <Separator orientation='vertical' className={DIVIDER} />}

                {showClusters && (
                    <BottomBarSegment label='clusters' onClick={() => openModal(DASHBOARD_DRAWER_IDS.clusters)}>
                        <BottomBarMetric
                            icon={<Cpu size={13} />}
                            value={`${clusterMetrics.avgCpu}%`}
                            critical={clusterMetrics.hasCritical}
                        />
                        <BottomBarMetric icon={<MemoryStick size={13} />} value={`${clusterMetrics.avgMemory}%`} />
                        <BottomBarMetric icon={<HardDrive size={13} />} value={`${clusterMetrics.avgDisk}%`} />
                        <BottomBarMetric icon={<ArrowDown size={13} />} value={formatNetworkSpeed(clusterMetrics.incoming)} />
                        <BottomBarMetric icon={<ArrowUp size={13} />} value={formatNetworkSpeed(clusterMetrics.outgoing)} />
                    </BottomBarSegment>
                )}

                {showPresence && <Separator orientation='vertical' className={DIVIDER} />}

                {showPresence && (
                    <BottomBarSegment label='team presence' icon={<Users size={13} />} onClick={() => openModal(DASHBOARD_DRAWER_IDS.presence)}>
                        <span className='text-xs text-muted'>
                            <span className={cn(PRESENCE_DOT, presenceCounts.online > 0 ? 'bg-success' : 'bg-muted')} aria-hidden='true' />
                            {presenceCounts.online} / {presenceCounts.total} online
                        </span>
                    </BottomBarSegment>
                )}
            </div>
        </footer>
    );
};

export default DashboardBottomBar;
