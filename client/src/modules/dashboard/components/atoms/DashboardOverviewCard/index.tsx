import './DashboardOverviewCard.css';
import TinyLineChart from '../TinyLineChart';
import DashboardCard from '@/modules/dashboard/components/atoms/DashboardCard';
import Container from '@/shared/presentation/components/Container';
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
                    <Container className='d-flex column gap-1 p-relative z-5'>
                        <Container className='d-flex items-center gap-075'>
                            <Container className='dashboard-stat-card-icon d-flex flex-center radius-md'>
                                {icon}
                            </Container>
                            <span className='font-size-2 font-weight-5'>{card.name}</span>
                        </Container>

                        <Container className='d-flex items-end gap-075'>
                            <span className='dashboard-stat-value'>{card.count}</span>
                            <Container className={`dashboard-stat-trend d-flex items-center gap-025 ${up ? 'up' : 'down'}`} style={{ marginBottom: '0.3rem' }}>
                                {trendIcon}
                                <span>{Math.abs(card.lastMonthStatus ?? 0)}%</span>
                            </Container>
                        </Container>

                        <span className='font-size-1 color-muted'>vs last month</span>
                    </Container>

                    <Container className='dashboard-stat-navigate p-absolute top-1 right-1'>
                        <GoArrowRight />
                    </Container>

                    <Container className='dashboard-stat-sparkline p-absolute bottom-0 right-0'>
                        <TinyLineChart
                            lineColor={lineColor || '#30d158'}
                            pData={card.series}
                            xLabels={card.labels}
                            yDomain={card.yDomain}
                            width={160}
                            height={60}
                        />
                    </Container>
                </button>
            ) : (
                <>
                    <Container className='d-flex column gap-1 p-relative z-5 dashboard-stat-card-content'>
                        <Container className='d-flex items-center gap-075'>
                            <Container className='dashboard-stat-card-icon d-flex flex-center radius-md'>
                                {icon}
                            </Container>
                            <span className='font-size-2 font-weight-5'>{card.name}</span>
                        </Container>

                        <Container className='d-flex items-end gap-075'>
                            <span className='dashboard-stat-value'>{card.count}</span>
                            <Container className={`dashboard-stat-trend d-flex items-center gap-025 ${up ? 'up' : 'down'}`} style={{ marginBottom: '0.3rem' }}>
                                {trendIcon}
                                <span>{Math.abs(card.lastMonthStatus ?? 0)}%</span>
                            </Container>
                        </Container>

                        <span className='font-size-1 color-muted'>vs last month</span>
                    </Container>

                    <Container className='dashboard-stat-sparkline p-absolute bottom-0 right-0'>
                        <TinyLineChart
                            lineColor={lineColor || '#30d158'}
                            pData={card.series}
                            xLabels={card.labels}
                            yDomain={card.yDomain}
                            width={160}
                            height={60}
                        />
                    </Container>
                </>
            )}
        </DashboardCard>
    );
};

export default DashboardOverviewCard;
