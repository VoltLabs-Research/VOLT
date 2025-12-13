import React from 'react';
import { Skeleton } from '@mui/material';

const DashboardStatsSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
    return(
        <div className='dashboard-stats-container'>
            {Array.from({ length: count }).map((_, i) => (
                <div className='dashboard-stat-container' key={i}>
                    <div className='dashboard-stat-left-container'>
                        <div className='dashboard-stat-header-container'>
                            <i className='dashboard-stat-icon-container'>
                                <Skeleton variant='circular' width={28} height={28} />
                            </i>
                            <div style={{ width: 120 }}>
                                <Skeleton variant='text' width='100%' height={22} />
                            </div>
                        </div>
                        <div className='dashboard-stat-footer-container'>
                            <div style={{ width: 100 }}>
                                <Skeleton variant='text' width='100%' height={36} />
                            </div>
                            <div className='dashboard-stat-last-month-container'>
                                <div className='dashboard-stat-last-month-icon-container' style={{ gap: 6, display: 'flex', alignItems: 'center' }}>
                                    <Skeleton variant='circular' width={16} height={16} />
                                    <Skeleton variant='text' width={36} height={16} />
                                </div>
                                <div style={{ width: 80 }}>
                                    <Skeleton variant='text' width='100%' height={14} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='dashboard-stat-analytic-container'>
                        <Skeleton variant='rounded' width={150} height='100%' />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default DashboardStatsSkeleton;
