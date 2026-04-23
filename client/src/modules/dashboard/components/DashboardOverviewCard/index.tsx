import './DashboardOverviewCard.css';
import TinyLineChart from '../TinyLineChart';
import DashboardCard from '@/modules/dashboard/components/DashboardCard';
import { Box, Stack, Row, Text, IconFrame } from '@/shared/presentation/primitives';
import { useNavigate } from 'react-router';
import { FaArrowDownLong, FaArrowUpLong } from 'react-icons/fa6';
import { GoArrowRight } from 'react-icons/go';
import type { DashboardCard as DashboardMetricsCard } from '@/modules/dashboard/api/entities/dashboard';
import type { ReactNode } from 'react';

interface DashboardOverviewCardProps {
    card: DashboardMetricsCard;
    icon: ReactNode;
};

const DashboardOverviewCard = ({ card, icon }: DashboardOverviewCardProps) => {
    const navigate = useNavigate();
    const up = (card.lastMonthStatus ?? 0) >= 0;
    const isClickable = Boolean(card.listingUrl && !card.listingUrl.includes(':trajectoryId'));

    const handleClick = () => {
        if (isClickable && card.listingUrl) {
            navigate(card.listingUrl);
        }
    };

    let lineColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-red').trim();
    if (up) {
        lineColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-green').trim();
    }

    let trendIcon = <FaArrowDownLong size={10} />;
    if (up) {
        trendIcon = <FaArrowUpLong size={10} />;
    }

    return (
        <DashboardCard className='dashboard-stat-card' isRelative={true} overflowHidden={true}>
            {isClickable ? (
                <button
                    type='button'
                    className='dashboard-stat-card-button'
                    onClick={handleClick}
                    aria-label={`Open ${card.name}`}
                >
                    <Stack gap='1' position='relative' zIndex='5'>
                        <Row gap='075'>
                            <IconFrame size='md' className='dashboard-stat-card-icon'>
                                {icon}
                            </IconFrame>
                            <Text size='md' weight='medium'>{card.name}</Text>
                        </Row>

                        <Row align='end' gap='075'>
                            <span className='dashboard-stat-value'>{card.count}</span>
                            <Row gap='025' className={`dashboard-stat-trend ${up ? 'up' : 'down'}`} style={{ marginBottom: '0.3rem' }}>
                                {trendIcon}
                                <span>{Math.abs(card.lastMonthStatus ?? 0)}%</span>
                            </Row>
                        </Row>

                        <Text size='sm' tone='muted'>vs last month</Text>
                    </Stack>

                    <Box position='absolute' top='1' right='1' className='dashboard-stat-navigate'>
                        <GoArrowRight />
                    </Box>

                    <Box position='absolute' bottom='0' right='0' className='dashboard-stat-sparkline'>
                        <TinyLineChart
                            lineColor={lineColor || '#30d158'}
                            pData={card.series}
                            xLabels={card.labels}
                            yDomain={card.yDomain}
                            width={160}
                            height={60}
                        />
                    </Box>
                </button>
            ) : (
                <>
                    <Stack gap='1' position='relative' zIndex='5' className='dashboard-stat-card-content'>
                        <Row gap='075'>
                            <IconFrame size='md' className='dashboard-stat-card-icon'>
                                {icon}
                            </IconFrame>
                            <Text size='md' weight='medium'>{card.name}</Text>
                        </Row>

                        <Row align='end' gap='075'>
                            <span className='dashboard-stat-value'>{card.count}</span>
                            <Row gap='025' className={`dashboard-stat-trend ${up ? 'up' : 'down'}`} style={{ marginBottom: '0.3rem' }}>
                                {trendIcon}
                                <span>{Math.abs(card.lastMonthStatus ?? 0)}%</span>
                            </Row>
                        </Row>

                        <Text size='sm' tone='muted'>vs last month</Text>
                    </Stack>

                    <Box position='absolute' bottom='0' right='0' className='dashboard-stat-sparkline'>
                        <TinyLineChart
                            lineColor={lineColor || '#30d158'}
                            pData={card.series}
                            xLabels={card.labels}
                            yDomain={card.yDomain}
                            width={160}
                            height={60}
                        />
                    </Box>
                </>
            )}
        </DashboardCard>
    );
};

export default DashboardOverviewCard;
