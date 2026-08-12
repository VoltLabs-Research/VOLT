import { cn } from '@heroui/react';
import Sparkline from '@/modules/dashboard/components/Sparkline';
import DashboardCard from '@/modules/dashboard/components/DashboardCard';
import { getTrendColor } from '@/modules/dashboard/utils/trend-color';
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import type { DashboardCard as DashboardMetricsCard } from '@/modules/dashboard/contracts/cards';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface DashboardOverviewCardProps {
    card: DashboardMetricsCard;
    icon: ReactNode;
}

interface DashboardStatContentProps extends DashboardOverviewCardProps {
    isPositiveTrend: boolean;
    className?: string;
}

interface DashboardSparklineProps {
    card: DashboardMetricsCard;
    color: string;
}

const DashboardStatContent = ({ card, icon, isPositiveTrend, className }: DashboardStatContentProps) => {
    const TrendIcon = isPositiveTrend ? ArrowUp : ArrowDown;

    return (
        <div className={cn('flex flex-col gap-4 relative z-[5]', className)}>
            <div className='flex flex-row items-center gap-3'>
                <span className='inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border text-base text-muted transition-[color,border-color] duration-200 ease-[ease] group-hover/card:text-foreground group-hover/card:border-foreground' aria-hidden='true'>
                    {icon}
                </span>
                <span className='text-sm font-medium'>{card.name}</span>
            </div>

            <div className='flex flex-row items-end gap-3'>
                <span className='text-3xl font-semibold leading-none tracking-[-0.02em] text-foreground'>{card.count}</span>
                <div className={cn('flex flex-row items-center gap-1 mb-1 text-xs font-semibold', isPositiveTrend ? 'text-success' : 'text-danger')}>
                    <TrendIcon size={10} />
                    <span>{Math.abs(card.lastMonthStatus)}%</span>
                </div>
            </div>

            <span className='text-xs text-muted'>vs last month</span>
        </div>
    );
};

const DashboardSparkline = ({ card, color }: DashboardSparklineProps) => (
    <div className='absolute bottom-0 right-0 pointer-events-none opacity-50 transition-opacity duration-200 ease-[ease] group-hover/card:opacity-85'>
        <Sparkline
            color={color}
            values={card.series}
            labels={card.labels}
            yDomain={card.yDomain}
            width={160}
            height={60}
        />
    </div>
);

const DashboardOverviewCard = ({ card, icon }: DashboardOverviewCardProps) => {
    const navigate = useNavigate();
    const isPositiveTrend = card.lastMonthStatus >= 0;
    const isClickable = Boolean(card.listingUrl);

    const handleClick = () => {
        if (card.listingUrl) {
            navigate(card.listingUrl);
        }
    };

    const lineColor = getTrendColor(isPositiveTrend);

    return (
        <DashboardCard className='group/card col-span-3 p-0 min-h-[130px] transition-[border-color] duration-200 ease-[ease] max-[1200px]:col-span-6 max-[768px]:col-span-12' isRelative={true} overflowHidden={true}>
            {isClickable ? (
                <button
                    type='button'
                    className='group/statbtn relative h-full w-full cursor-pointer border-none bg-transparent p-4 text-left focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--border),inset_0_0_0_3px_var(--focus)]'
                    onClick={handleClick}
                    aria-label={`Open ${card.name}`}
                >
                    <DashboardStatContent card={card} icon={icon} isPositiveTrend={isPositiveTrend} />

                    <div className='absolute top-4 right-4 text-lg text-foreground opacity-0 transition-opacity duration-200 ease-[ease] group-hover/card:opacity-100 group-focus-visible/statbtn:opacity-100'>
                        <ArrowRight />
                    </div>

                    <DashboardSparkline card={card} color={lineColor} />
                </button>
            ) : (
                <>
                    <DashboardStatContent card={card} icon={icon} isPositiveTrend={isPositiveTrend} />
                    <DashboardSparkline card={card} color={lineColor} />
                </>
            )}
        </DashboardCard>
    );
};

export default DashboardOverviewCard;
