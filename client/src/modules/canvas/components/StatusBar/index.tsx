import { Separator, cn } from '@heroui/react';
import { formatSize } from '@/shared/utils/format';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import type { ReactNode } from 'react';
import Scrollable from '@/shared/ui/components/Scrollable';

interface StatusItem {
    key: string;
    label: string;
    value: ReactNode;
    title?: string;
    className?: string;
}

interface StatusBarProps {
    trajectory: Trajectory | null | undefined;
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

const StatusBar = ({ trajectory }: StatusBarProps) => {
    const atoms = trajectory?.frames?.[0]?.natoms ?? 0;
    const frames = trajectory?.frames?.length ?? 0;
    const size = trajectory?.stats?.totalSize !== undefined ? formatSize(trajectory.stats.totalSize) : '—';

    const items: StatusItem[] = [
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

    return (
        <Scrollable className='flex h-7 w-full flex-row items-center gap-3 px-3'>
            <StatusGroup items={items} />
        </Scrollable>
    );
};

export default StatusBar;
