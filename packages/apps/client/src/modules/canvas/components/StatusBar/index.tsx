import { Separator } from '@heroui/react';
import { formatSize } from '@/shared/utils/format';
import { useEditorStore } from '@/modules/canvas/store/editor';
import { useShallow } from 'zustand/react/shallow';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import type { ReactNode } from 'react';
import Scrollable from '@/shared/ui/components/Scrollable';

interface StatusItem {
    key: string;
    label: string;
    value: ReactNode;
}

interface StatusBarProps {
    trajectory: Trajectory | null | undefined;
}

const StatusGroup = ({ items }: { items: StatusItem[] }) => (
    <div className='flex flex-row items-center gap-2'>
        {items.map(({ key, label, value }, i) => (
            <div className='flex flex-row items-center gap-2' key={key}>
                {i > 0 && <Separator orientation='vertical' className='h-3 w-px bg-foreground/10' />}
                <span className='whitespace-nowrap text-xs tabular-nums text-muted'>
                    {label}{label && ': '}{value}
                </span>
            </div>
        ))}
    </div>
);

const StatusBar = ({ trajectory }: StatusBarProps) => {
    const { isPreloading, preloadProgress, preloadTotal } = useEditorStore(useShallow((state) => ({
        isPreloading: Boolean(state.isPreloading),
        preloadProgress: state.preloadProgress ?? 0,
        preloadTotal: state.preloadTotal
    })));
    const atoms = trajectory?.frames?.[0]?.natoms ?? 0;
    const frames = trajectory?.frames?.length ?? 0;
    const size = trajectory?.stats?.totalSize !== undefined ? formatSize(trajectory.stats.totalSize) : '—';
    const cached = Math.round(preloadProgress * preloadTotal);

    // Until the trajectory arrives there is nothing to count, so the bar stays empty instead of reading 0.
    const items: StatusItem[] = trajectory ? [
        ...(isPreloading ? [{
            key: 'caching',
            label: '',
            value: preloadTotal > 0
                ? `Caching timesteps for playback · ${cached} of ${preloadTotal}`
                : 'Caching timesteps for playback'
        }] : []),
        {
            key: 'atoms',
            label: 'Atoms',
            value: atoms
        },
        {
            key: 'frames',
            label: 'Frames',
            value: frames
        },
        {
            key: 'size',
            label: 'Size',
            value: size
        }
    ] : [];

    return (
        <Scrollable orientation='horizontal' className='flex h-7 w-full flex-row items-center gap-3 px-3 max-md:pointer-events-auto max-md:order-4 max-md:h-5 max-md:px-1.5'>
            <StatusGroup items={items} />
        </Scrollable>
    );
};

export default StatusBar;
