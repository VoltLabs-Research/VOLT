import { Skeleton } from '@heroui/react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type ChartStatEmphasis = 'primary' | 'secondary';

export interface ChartStat {
    label: string;
    value: string | number;
    emphasis?: ChartStatEmphasis;
};

interface ChartContainerProps {
    icon: LucideIcon | (() => ReactNode);
    title: string;
    isLoading: boolean;
    children: ReactNode;
    stats?: ChartStat[];
    statsLoading?: boolean;
};

const STAT_VALUE_CLASS_NAMES: Record<ChartStatEmphasis, string> = {
    primary: 'tabular-nums lining-nums text-2xl font-semibold leading-none tracking-[-0.02em] text-foreground',
    secondary: 'tabular-nums lining-nums text-sm font-medium leading-[1.2] text-muted'
};

const STAT_SKELETON_CLASS_NAMES: Record<ChartStatEmphasis, string> = {
    primary: 'h-7 w-20 rounded-md',
    secondary: 'h-[18px] w-[50px] rounded-md'
};

const ChartContainer = ({
    icon: Icon,
    title,
    isLoading,
    children,
    stats,
    statsLoading = false
}: ChartContainerProps) => {
    const renderIcon = () => {
        if(typeof Icon === 'function' && !('$$typeof' in Icon)){
            return (Icon as () => ReactNode)();
        }
        const LucideIcon = Icon as LucideIcon;
        return <LucideIcon className='text-muted' style={{
            width: 20,
            height: 20
        }} />;
    };

    const renderStat = (stat: ChartStat) => {
        const emphasis: ChartStatEmphasis = stat.emphasis ?? 'secondary';

        return (
            <div className='flex flex-col gap-1' key={stat.label}>
                <span className='text-xs font-semibold uppercase tracking-[0.05em] text-muted'>
                    {stat.label}
                </span>
                {statsLoading ? (
                    <Skeleton className={STAT_SKELETON_CLASS_NAMES[emphasis]} />
                ) : (
                    <span className={STAT_VALUE_CLASS_NAMES[emphasis]}>
                        {stat.value}
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className='flex flex-col p-6 rounded-2xl h-full max-h-[400px] border border-border bg-surface sm:p-1'>
            <div className='flex justify-between mb-6 sm:gap-1'>
                <div className='flex flex-row items-center gap-3'>
                    {renderIcon()}
                    <h3 className='text-base font-semibold text-foreground'>
                        {title}
                    </h3>
                </div>
                {stats && (
                    <div className='flex flex-row items-end flex-wrap gap-6 sm:w-max sm:gap-1'>
                        {stats.map(renderStat)}
                    </div>
                )}
            </div>

            {isLoading ? (
                <Skeleton className='h-[280px] w-full rounded-lg' />
            ) : (
                children
            )}
        </div>
    );
};

export default ChartContainer;
