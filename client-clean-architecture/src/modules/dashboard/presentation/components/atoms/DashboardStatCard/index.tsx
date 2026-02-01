import { useNavigate } from 'react-router';
import { HiOutlineServerStack } from 'react-icons/hi2';
import { FaArrowUpLong, FaArrowDownLong } from 'react-icons/fa6';
import { GoArrowRight } from 'react-icons/go';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import TinyLineChart from '../TinyLineChart';

interface DashboardStatCardProps {
    name: string;
    count: string;
    lastMonthStatus?: number;
    listingUrl?: string;
    series: number[];
    labels: string[];
    yDomain?: { min: number; max: number };
    themeColors: {
        success: string;
        error: string;
    };
    pluginName?: string;
};

const DashboardStatCard = ({
    name,
    count,
    lastMonthStatus,
    listingUrl,
    series,
    labels,
    yDomain,
    themeColors,
    pluginName
}: DashboardStatCardProps) => {
    const navigate = useNavigate();
    const up = (lastMonthStatus ?? 0) >= 0;
    const isClickable = Boolean(listingUrl && !listingUrl.includes(':trajectoryId'));

    const handleClick = () => {
        if (isClickable && listingUrl) {
            navigate(listingUrl);
        }
    };

    return (
        <Container
            onClick={handleClick}
            className='dashboard-stat-container p-relative cursor-pointer'
            style={{ cursor: isClickable ? 'pointer' : 'default' }}
        >
            <Container className='d-flex column gap-2 w-max'>
                <Container className='d-flex column gap-1 justify-center' style={{ minHeight: '38px' }}>
                    <Container className='d-flex items-center gap-1'>
                        <i className='d-flex flex-center dashboard-stat-icon-container color-muted'>
                            <HiOutlineServerStack />
                        </i>
                        <Container className='d-flex column gap-02'>
                            <Title className='font-size-3 color-primary'>{name}</Title>
                            {pluginName && (
                                <span className='font-size-1 color-primary font-weight-4'>
                                    {pluginName}
                                </span>
                            )}
                        </Container>
                    </Container>
                </Container>
                <Container className='d-flex column gap-1'>
                    <Title className='font-size-5 color-primary'>{count}</Title>
                    <Container className='d-flex gap-025'>
                        <Container className='d-flex items-center gap-05 dashboard-stat-last-month-icon-container'>
                            <i className={up ? 'up' : 'down'}>
                                {up ? <FaArrowUpLong /> : <FaArrowDownLong />}
                            </i>
                            <span className='font-weight-6'>
                                {Math.abs(lastMonthStatus ?? 0)}%
                            </span>
                        </Container>
                        <span className='color-primary'>Last Month</span>
                    </Container>
                </Container>
            </Container>

            <i className='dashboard-stat-arrow-icon-container p-absolute font-size-5'>
                <GoArrowRight />
            </i>

            <Container className='dashboard-stat-analytic-container p-absolute'>
                <TinyLineChart
                    lineColor={up ? themeColors.success : themeColors.error}
                    pData={series}
                    xLabels={labels}
                    yDomain={yDomain}
                    width={200}
                    height={80}
                />
            </Container>
        </Container>
    );
};

export default DashboardStatCard;
