import { useMemo } from 'react';
import Container from '@/shared/presentation/components/Container';
import DashboardStatsSkeleton from '../DashboardStatsSkeleton';
import DashboardStatCard from '../DashboardStatCard';
import useDashboardMetrics from '@/modules/dashboard/presentation/hooks/use-dashboard-metrics';
import type { DashboardCard } from '@/modules/dashboard/domain/entities';

interface DashboardStatsProps {
    teamId?: string;
};

const DashboardStats = ({ teamId }: DashboardStatsProps) => {
    const { loading, error, cards } = useDashboardMetrics(teamId);

    const themeColors = useMemo(() => {
        const root = document.documentElement;
        const styles = getComputedStyle(root);
        return {
            success: styles.getPropertyValue('--accent-green'),
            error: styles.getPropertyValue('--accent-red'),
        };
    }, []);

    if(loading){
        return <DashboardStatsSkeleton count={3} />;
    }

    if(error){
        return (
            <Container className='dashboard-stats-container w-max overflow-hidden radius-lg'>
                <Container className='color-secondary p-1-5'>{error}</Container>
            </Container>
        );
    }

    return (
        <Container className='d-flex dashboard-stats-container w-max overflow-hidden radius-lg'>
            {cards.map((card: DashboardCard, index: number) => (
                <DashboardStatCard
                    key={index}
                    name={card.name}
                    count={card.count}
                    lastMonthStatus={card.lastMonthStatus}
                    listingUrl={card.listingUrl}
                    series={card.series}
                    labels={card.labels}
                    yDomain={card.yDomain}
                    themeColors={themeColors}
                    pluginName={card.pluginName}
                />
            ))}
        </Container>
    );
};

export default DashboardStats;
