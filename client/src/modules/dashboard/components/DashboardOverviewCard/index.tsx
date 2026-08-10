import { cn } from '@heroui/react';
import Sparkline from '@/modules/dashboard/components/Sparkline';
import DashboardCard from '@/modules/dashboard/components/DashboardCard';
import {
    STAT_CARD,
    STAT_CARD_BUTTON,
    STAT_CARD_ICON,
    STAT_NAVIGATE,
    STAT_SPARKLINE,
    STAT_TREND,
    STAT_VALUE
} from '@/modules/dashboard/components/stat-tile-chrome';
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
                <span className={STAT_CARD_ICON} aria-hidden='true'>
                    {icon}
                </span>
                <span className='text-sm font-medium'>{card.name}</span>
            </div>

            <div className='flex flex-row items-end gap-3'>
                <span className={STAT_VALUE}>{card.count}</span>
                <div className={cn(STAT_TREND, isPositiveTrend ? 'text-success' : 'text-danger')}>
                    <TrendIcon size={10} />
                    <span>{Math.abs(card.lastMonthStatus)}%</span>
                </div>
            </div>

            <span className='text-xs text-muted'>vs last month</span>
        </div>
    );
};

const DashboardSparkline = ({ card, color }: DashboardSparklineProps) => (
    <div className={STAT_SPARKLINE}>
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
        <DashboardCard className={STAT_CARD} isRelative={true} overflowHidden={true}>
            {isClickable ? (
                <button
                    type='button'
                    className={STAT_CARD_BUTTON}
                    onClick={handleClick}
                    aria-label={`Open ${card.name}`}
                >
                    <DashboardStatContent card={card} icon={icon} isPositiveTrend={isPositiveTrend} />

                    <div className={STAT_NAVIGATE}>
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
