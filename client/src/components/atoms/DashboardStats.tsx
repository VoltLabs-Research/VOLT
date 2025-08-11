import React from 'react';
import { TbHexagons } from 'react-icons/tb';
import { HiOutlineServerStack } from 'react-icons/hi2';
import { PiLineSegments } from 'react-icons/pi';
import { FaArrowUpLong, FaArrowDownLong } from 'react-icons/fa6';
import { useDashboardMetrics } from '@/hooks/dashboard/use-dashboard-metrics';
import TinyLineChart from '@/components/atoms/TinyLineChart';

const DashboardStats: React.FC<{ teamId?: string }> = ({ teamId }) => {
    const { loading, error, cards } = useDashboardMetrics(teamId);

    const icons: Record<string, React.ComponentType<any>> = {
        StructureAnalysis: TbHexagons,
        Trajectories: HiOutlineServerStack,
        Dislocations: PiLineSegments
    };

    if (loading) {
        return (
            <div className='dashboard-stats-container'>
                {Array.from({ length: 3 }).map((_, i) => (
                    <div className='dashboard-stat-container skeleton' key={i} />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className='dashboard-stats-container'>
                <div className='dashboard-error'>{error}</div>
            </div>
        );
    }

    return (
        <div className='dashboard-stats-container'>
            {cards.map(({ name, count, lastMonthStatus, series, labels, yDomain }, index) => {
                const Icon = icons[name.replace(' ', '')] || TbHexagons;
                const up = (lastMonthStatus ?? 0) >= 0;
                return (
                    <div className='dashboard-stat-container' key={index}>
                        <div className='dashboard-stat-left-container'>
                            <div className='dashboard-stat-header-container'>
                                <i className='dashboard-stat-icon-container'>
                                    <Icon />
                                </i>
                                <h3 className='dashboard-stat-title'>{name}</h3>
                            </div>
                            <div className='dashboard-stat-footer-container'>
                                <h3 className='dashboard-stat-count'>{count}</h3>
                                <div className='dashboard-stat-last-month-container'>
                                    <div className='dashboard-stat-last-month-icon-container'>
                                        <i className={`dashboard-stat-last-month-icon ${up ? 'up' : 'down'}`}>
                                            {up ? <FaArrowUpLong /> : <FaArrowDownLong />}
                                        </i>
                                        <span className='dashboard-stat-last-month-helper-text'>
                                            {Math.abs(lastMonthStatus ?? 0)}%
                                        </span>
                                    </div>
                                    <span className='dashboard-stat-last-month-title'>Last Month</span>
                                </div>
                            </div>
                        </div>

                        <div className='dashboard-stat-analytic-container'>
                            <TinyLineChart
                                lineColor={up ? '#28b85d' : '#e35151'}
                                pData={series}
                                xLabels={labels}
                                yDomain={yDomain}
                                width={200}
                                height={80}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default DashboardStats;
