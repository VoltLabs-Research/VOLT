import './ChartContainer.css';
import Skeleton from '@/shared/presentation/components/Skeleton';
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
        return <LucideIcon className='color-muted-foreground' style={{ width: 20, height: 20 }} />;
    };

    const renderStat = (stat: ChartStat) => {
        // Legacy default: treat stats without an emphasis flag as secondary
        // so old call sites keep their low-visual-weight behaviour.
        const emphasis: ChartStatEmphasis = stat.emphasis ?? 'secondary';
        const valueClassName = emphasis === 'primary'
            ? 'chart-stat-value chart-stat-value-primary'
            : 'chart-stat-value chart-stat-value-secondary';
        const skeletonWidth = emphasis === 'primary' ? 80 : 50;
        const skeletonHeight = emphasis === 'primary' ? 28 : 18;

        return (
            <div key={stat.label} className='volt-container d-flex column gap-025'>
                <span className='chart-stat-label font-size-1 color-muted'>
                    {stat.label}
                </span>
                {statsLoading ? (
                    <Skeleton variant='text' width={skeletonWidth} height={skeletonHeight} />
                ) : (
                    <span className={valueClassName}>
                        {stat.value}
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className='volt-container d-flex h-max column p-1-5 chart-container radius-lg sm:p-1'>
            <div className='volt-container d-flex content-between mb-1-5 sm:column sm:gap-1'>
                <div className='volt-container d-flex items-center gap-075'>
                    {renderIcon()}
                    <h3 className='volt-title font-size-3 chart-title font-weight-6 color-primary'>
                        {title}
                    </h3>
                </div>
                {stats && (
                    <div className='volt-container d-flex items-end gap-1-5 flex-wrap sm:w-max sm:gap-1'>
                        {stats.map(renderStat)}
                    </div>
                )}
            </div>

            {isLoading ? (
                <Skeleton
                    variant='rectangular'
                    width='100%'
                    height={280}
                    style={{ borderRadius: 8 }}
                />
            ) : (
                children
            )}
        </div>
    );
};

export default ChartContainer;
