import { Separator, cn } from '@heroui/react';
import { formatSize } from '@/shared/utils/format';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import type { ReactNode } from 'react';

interface StatusItem {
    key: string;
    label: string;
    value: ReactNode;
    title?: string;
    className?: string;
}

interface StatusBarProps {
    trajectory: Trajectory | null | undefined;
    currentTimestep: number | undefined;
}

const StatusGroup = ({ items }: { items: StatusItem[] }) => (
    <div className='flex flex-row items-center gap-2'>
        {items.map(({ key, label, value, title, className }, i) => (
            <div className='flex flex-row items-center gap-2' key={key}>
                {i > 0 && <Separator orientation='vertical' className='h-3 w-px bg-border' />}
                <span className={cn('text-xs text-muted', className)} title={title}>
                    {label}{label && ': '}{value}
                </span>
            </div>
        ))}
    </div>
);

const StatusBar = ({ trajectory, currentTimestep }: StatusBarProps) => {
    let teamName = '-';
    if (trajectory && typeof trajectory.team === 'object' && trajectory.team) {
        teamName = trajectory.team.name;
    }

    const atoms = trajectory?.frames?.[0]?.natoms ?? 0;
    const frames = trajectory?.frames?.length ?? 0;
    const size = trajectory?.stats?.totalSize !== undefined ? formatSize(trajectory.stats.totalSize) : '—';

    const left: StatusItem[] = [
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
    ];

    const right: StatusItem[] = [
        {
            key: 'timestep',
            label: 'Timestep',
            value: currentTimestep ?? '—'
        },
        {
            key: 'team',
            label: '',
            value: teamName
        }
    ];

    /*
     * `--canvas-right-overlay-size` is written as an inline style on
     * `.canvas-editor-root` by `CanvasPage`, so the bar shrinks with the right panel.
     * The `var()` reference is kept rather than resolved, exactly as before.
     */
    return (
        <div className='flex h-7 w-[calc(100%-max(12px,var(--canvas-right-overlay-size,0px)))] flex-row items-center justify-between gap-3 overflow-scroll px-3'>
            <div className='flex flex-row items-center gap-2'>
                <StatusGroup items={left} />
            </div>
            <StatusGroup items={right} />
        </div>
    );
};

export default StatusBar;
