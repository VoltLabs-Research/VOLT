import React from 'react';
import { HiOutlineServerStack } from 'react-icons/hi2';
import { PiLineSegments } from 'react-icons/pi';
import { FaArrowUpLong, FaArrowDownLong } from 'react-icons/fa6';
import { GoArrowRight } from 'react-icons/go';
import { useNavigate } from 'react-router';
import { RiVipDiamondLine } from "react-icons/ri";
import { useDashboardMetrics } from '@/hooks/dashboard/use-dashboard-metrics';
import TinyLineChart from '@/components/atoms/TinyLineChart';
import DashboardStatsSkeleton from '@/components/atoms/DashboardStatsSkeleton';

const DashboardStats: React.FC<{ teamId?: string }> = ({ teamId }) => {
    const { loading, error, cards } = useDashboardMetrics(teamId);
    const navigate = useNavigate();

    const icons: Record<string, React.ComponentType<any>> = {
        StructureAnalysis: RiVipDiamondLine,
        Trajectories: HiOutlineServerStack,
        AnalysisConfigs: RiVipDiamondLine,
        Dislocations: PiLineSegments
    };

    if(loading){
        return <DashboardStatsSkeleton count={3} />;
    }

    if(error){
        return (
            <div className='dashboard-stats-container'>
                <div className='dashboard-error'>{error}</div>
            </div>
        );
    }

    return (
        <div className='dashboard-stats-container'>
            {cards
                .filter(({ key }) => key !== 'dislocations')
                .map(({ name, listingUrl, count, lastMonthStatus, series, labels, yDomain }, index) => {
                const iconKey = name.replace(/\s+/g, '');
                const Icon = icons[iconKey] || HiOutlineServerStack;
                const up = (lastMonthStatus ?? 0) >= 0;
                return (
                    <div 
                        onClick={() => navigate(listingUrl)}
                        className='dashboard-stat-container' 
                        key={index}
                    >
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

                        <i className='dashboard-stat-arrow-icon-container'>
                            <GoArrowRight />
                        </i>

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
