import React from 'react';
import type { MetricEntry } from '@/types/raster';

const MetricItem: React.FC<MetricEntry> = ({ label, value, icon: Icon }) => {
    return(
        <div className='raster-metric-item'>
            <i className='raster-metric-icon'>
                <Icon size={16} />
            </i>

            <span className='raster-metric-label'>{label}:</span>
            <b className='raster-metric-value'>{value}</b>
        </div>
    )
};

export default MetricItem;
