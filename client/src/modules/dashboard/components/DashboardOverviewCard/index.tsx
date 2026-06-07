import './DashboardOverviewCard.css';
import { Sparkline, Box, IconFrame, Row, Stack, Text } from '@voltstack/bravais';
import DashboardCard from '@/modules/dashboard/components/DashboardCard';
import { FaArrowDownLong, FaArrowUpLong } from 'react-icons/fa6';
import { GoArrowRight } from 'react-icons/go';
import type { DashboardCard as DashboardMetricsCard } from '@/modules/dashboard/api/entities/dashboard';
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

const getTrendColor = (isPositiveTrend: boolean): string => {
    const colorVariable = isPositiveTrend ? '--accent-green' : '--accent-red';
    return getComputedStyle(document.documentElement).getPropertyValue(colorVariable).trim() || '#30d158';
};

const DashboardStatContent = ({ card, icon, isPositiveTrend, className }: DashboardStatContentProps) => {
    const TrendIcon = isPositiveTrend ? FaArrowUpLong : FaArrowDownLong;

    return (
        <Stack gap='1' position='relative' zIndex='5' className={className}>
            <Row gap='075'>
                <IconFrame size='md' className='dashboard-stat-card-icon'>
                    {icon}
                </IconFrame>
                <Text size='md' weight='medium'>{card.name}</Text>
            </Row>

            <Row align='end' gap='075'>
                <Text as='span' className='dashboard-stat-value'>{card.count}</Text>
                <Row gap='025' className={`dashboard-stat-trend ${isPositiveTrend ? 'up' : 'down'}`} style={{ marginBottom: '0.3rem' }}>
                    <TrendIcon size={10} />
                    <Text as='span'>{Math.abs(card.lastMonthStatus ?? 0)}%</Text>
                </Row>
            </Row>

            <Text size='sm' tone='muted'>vs last month</Text>
        </Stack>
    );
};

const DashboardSparkline = ({ card, color }: DashboardSparklineProps) => (
    <Box position='absolute' bottom='0' right='0' className='dashboard-stat-sparkline'>
        <Sparkline
            color={color}
            values={card.series}
            labels={card.labels}
            yDomain={card.yDomain}
            width={160}
            height={60}
        />
    </Box>
);

const DashboardOverviewCard = ({ card, icon }: DashboardOverviewCardProps) => {
    const navigate = useNavigate();
    const isPositiveTrend = (card.lastMonthStatus ?? 0) >= 0;
    const isClickable = Boolean(card.listingUrl && !card.listingUrl.includes(':trajectoryId'));

    const handleClick = () => {
        if (isClickable && card.listingUrl) {
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

                    <Box position='absolute' top='1' right='1' className='dashboard-stat-navigate'>
                        <GoArrowRight />
                    </Box>

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
