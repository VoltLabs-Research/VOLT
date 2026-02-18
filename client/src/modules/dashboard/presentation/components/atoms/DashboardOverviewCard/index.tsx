import { useNavigate } from 'react-router';
import { GoArrowRight } from 'react-icons/go';
import { FaArrowUpLong, FaArrowDownLong } from 'react-icons/fa6';
import Container from '@/shared/presentation/components/Container';
import TinyLineChart from '../TinyLineChart';
import type { DashboardCard } from '@/modules/dashboard/domain/entities';
import './DashboardOverviewCard.css';

interface DashboardOverviewCardProps {
    card: DashboardCard;
    icon: React.ReactNode;
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

    const lineColor = up
        ? getComputedStyle(document.documentElement).getPropertyValue('--accent-green').trim()
        : getComputedStyle(document.documentElement).getPropertyValue('--accent-red').trim();

    return (
        <Container
            className='dashboard-stat-card'
            onClick={handleClick}
            style={{ cursor: isClickable ? 'pointer' : 'default' }}
        >
            <Container className='d-flex column gap-1 p-relative z-5'>
                <Container className='d-flex items-center gap-075'>
                    <Container className='dashboard-stat-card-icon d-flex flex-center radius-md'>
                        {icon}
                    </Container>
                    <Container className='d-flex column gap-01'>
                        <span className='font-size-2 font-weight-5'>{card.name}</span>
                        {card.pluginName && (
                            <span className='font-size-1 color-muted'>{card.pluginName}</span>
                        )}
                    </Container>
                </Container>

                <Container className='d-flex items-end gap-075'>
                    <span className='dashboard-stat-value'>{card.count}</span>
                    <Container className={`dashboard-stat-trend d-flex items-center gap-025 ${up ? 'up' : 'down'}`} style={{ marginBottom: '0.3rem' }}>
                        {up ? <FaArrowUpLong size={10} /> : <FaArrowDownLong size={10} />}
                        <span>{Math.abs(card.lastMonthStatus ?? 0)}%</span>
                    </Container>
                </Container>

                <span className='font-size-1 color-muted'>vs last month</span>
            </Container>

            {isClickable && (
                <Container className='dashboard-stat-navigate p-absolute top-1 right-1'>
                    <GoArrowRight />
                </Container>
            )}

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
        </Container>
    );
};

export default DashboardOverviewCard;
