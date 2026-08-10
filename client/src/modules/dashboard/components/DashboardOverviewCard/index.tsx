import { cn } from '@heroui/react';
import './DashboardOverviewCard.css';
import { Sparkline, IconFrame } from '@voltstack/bravais';
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
                <IconFrame size='md' className='dashboard-stat-card-icon'>
                    {icon}
                </IconFrame>
                <span className='text-sm font-medium'>{card.name}</span>
            </div>

            <div className='flex flex-row items-end gap-3'>
                <span className='dashboard-stat-value'>{card.count}</span>
                <div className={cn('flex flex-row items-center gap-1', `dashboard-stat-trend ${isPositiveTrend ? 'up' : 'down'}`)} style={{ marginBottom: '0.3rem' }}>
                    <TrendIcon size={10} />
                    <span>{Math.abs(card.lastMonthStatus)}%</span>
                </div>
            </div>

            <span className='text-xs text-muted'>vs last month</span>
        </div>
    );
};

const DashboardSparkline = ({ card, color }: DashboardSparklineProps) => (
    <div className='absolute bottom-0 right-0 dashboard-stat-sparkline'>
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
        <DashboardCard className='dashboard-stat-card' isRelative={true} overflowHidden={true}>
            {isClickable ? (
                <button
                    type='button'
                    className='dashboard-stat-card-button'
                    onClick={handleClick}
                    aria-label={`Open ${card.name}`}
                >
                    <DashboardStatContent card={card} icon={icon} isPositiveTrend={isPositiveTrend} />

                    <div className='absolute top-4 right-4 dashboard-stat-navigate'>
                        <ArrowRight />
                    </div>

                    <DashboardSparkline card={card} color={lineColor} />
                </button>
            ) : (
                <>
                    <DashboardStatContent card={card} icon={icon} isPositiveTrend={isPositiveTrend} className='dashboard-stat-card-content' />
                    <DashboardSparkline card={card} color={lineColor} />
                </>
            )}
        </DashboardCard>
    );
};

export default DashboardOverviewCard;
