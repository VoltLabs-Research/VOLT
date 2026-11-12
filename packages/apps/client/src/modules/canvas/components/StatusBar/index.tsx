import { formatSize } from '@/shared/utils/format';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import Scrollable from '@/shared/ui/components/Scrollable';

interface StatusBarProps {
    trajectory: Trajectory | null | undefined;
}

const countFormat = new Intl.NumberFormat('en-US');

// "36,624 atoms", "1 frame": the count in full, with its unit after it.
const formatCount = (count: number, unit: string) => `${countFormat.format(count)} ${unit}${count === 1 ? '' : 's'}`;

const StatusBar = ({ trajectory }: StatusBarProps) => {
    const atoms = trajectory?.frames?.[0]?.natoms ?? 0;
    const frames = trajectory?.frames?.length ?? 0;
    const size = trajectory?.stats?.totalSize !== undefined ? formatSize(trajectory.stats.totalSize) : '—';

    // Until the trajectory arrives there is nothing to count, so the bar stays empty instead of reading 0.
    // Caching for playback is shown by PlaybackCachingIsland, not here.
    const text = trajectory ? [formatCount(atoms, 'atom'), formatCount(frames, 'frame'), size].join(' · ') : '';

    return (
        <Scrollable orientation='horizontal' className='flex h-7 w-full flex-row items-center gap-3 px-3 max-md:pointer-events-auto max-md:order-4 max-md:h-5 max-md:px-1.5'>
            <span className='whitespace-nowrap text-xs tabular-nums text-muted'>{text}</span>
        </Scrollable>
    );
};

export default StatusBar;
