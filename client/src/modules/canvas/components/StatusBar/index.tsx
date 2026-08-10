import { cn } from '@heroui/react';
import { formatSize } from '@/shared/utils/format';
import { Divider } from '@voltstack/bravais';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import type { ReactNode } from 'react';

import './StatusBar.css';

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
    <div className='flex flex-row items-center gap-2 canvas-status-group'>
        {items.map(({ key, label, value, title, className }, i) => (
            <div className='flex flex-row items-center gap-2 canvas-status-item' key={key}>
                {i > 0 && <Divider orientation='vertical' className="canvas-status-divider" />}
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

    return (
        <div className='flex flex-row items-center justify-between canvas-status-bar'>
            <div className='flex flex-row items-center gap-2 canvas-status-main'>
                <StatusGroup items={left} />
            </div>
            <StatusGroup items={right} />
        </div>
    );
};

export default StatusBar;
