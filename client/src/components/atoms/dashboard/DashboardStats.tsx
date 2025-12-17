import React from 'react';
import { HiOutlineServerStack } from 'react-icons/hi2';
import { PiLineSegments } from 'react-icons/pi';
import { FaArrowUpLong, FaArrowDownLong } from 'react-icons/fa6';
import { GoArrowRight } from 'react-icons/go';
import { useNavigate } from 'react-router';
import { RiVipDiamondLine } from "react-icons/ri";
import useDashboardMetrics from '@/hooks/dashboard/use-dashboard-metrics';
import TinyLineChart from '@/components/atoms/common/TinyLineChart';
import DashboardStatsSkeleton from '@/components/atoms/dashboard/DashboardStatsSkeleton';
import Title from '@/components/primitives/Title';

const DashboardStats: React.FC<{ teamId?: string; trajectoryId?: string }> = ({ teamId, trajectoryId }) => {
    const { loading, error, cards } = useDashboardMetrics(teamId, trajectoryId);
    const navigate = useNavigate();

    const icons: Record<string, React.ComponentType<any>> = {
        StructureAnalysis: RiVipDiamondLine,
        Trajectories: HiOutlineServerStack,
        AnalysisConfigs: RiVipDiamondLine,
        Dislocations: PiLineSegments
    };

    if (loading) {
        return <DashboardStatsSkeleton count={3} />;
    }

    if (error) {
        return (
            <div className='dashboard-stats-container w-max overflow-hidden'>
                <div className='dashboard-error'>{error}</div>
            </div>
        );
    }

    return (
        <div className='d-flex dashboard-stats-container w-max overflow-hidden'>
            {cards.map(({ name, listingUrl, count, lastMonthStatus, series, labels, yDomain }, index) => {
                const iconKey = name.replace(/\s+/g, '');
                const Icon = icons[iconKey] || HiOutlineServerStack;
                const up = (lastMonthStatus ?? 0) >= 0;
                const isClickable = Boolean(listingUrl && !listingUrl.includes(':trajectoryId'));
                return (
                    <div
                        onClick={() => isClickable && listingUrl && navigate(listingUrl)}
                        className='dashboard-stat-container p-relative cursor-pointer'
                        style={{ cursor: isClickable ? 'pointer' : 'default' }}
                        key={index}
                    >
                        <div className='d-flex column gap-2 dashboard-stat-left-container w-max'>
                            <div className='d-flex items-center dashboard-stat-header-container gap-1'>
                                <i className='d-flex flex-center dashboard-stat-icon-container color-muted'>
                                    <Icon />
                                </i>
                                <Title className='font-size-3 dashboard-stat-title color-primary'>{name}</Title>
                            </div>
                            <div className='d-flex column gap-1'>
                                <Title className='font-size-5 color-primary'>{count}</Title>
                                <div className='d-flex gap-025 dashboard-stat-last-month-container'>
                                    <div className='d-flex items-center gap-05 dashboard-stat-last-month-icon-container'>
                                        <i className={`dashboard-stat-last-month-icon ${up ? 'up' : 'down'}`}>
                                            {up ? <FaArrowUpLong /> : <FaArrowDownLong />}
                                        </i>
                                        <span className='dashboard-stat-last-month-helper-text font-weight-6'>
                                            {Math.abs(lastMonthStatus ?? 0)}%
                                        </span>
                                    </div>
                                    <span className='dashboard-stat-last-month-title color-primary'>Last Month</span>
                                </div>
                            </div>
                        </div>

                        <i className='dashboard-stat-arrow-icon-container p-absolute font-size-5'>
                            <GoArrowRight />
                        </i>

                        <div className='dashboard-stat-analytic-container p-absolute'>
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
