import React from 'react';
import type { MetricsBarProps } from '@/types/raster';
import MetricsBarSkeleton from '@/components/atoms/raster/MetricsBarSkeleton';
import MetricItem from '@/components/atoms/raster/MetricItem';
import ToggleOption from '@/components/atoms/ToggleOption';

const MetricsBar: React.FC<MetricsBarProps> = ({ 
    items, 
    isLoading, 
    showDislocations, 
    onToggleDislocations,
    showStructureAnalysis = false,
    onToggleStructureAnalysis 
}) => {
    if(isLoading) return <MetricsBarSkeleton count={4} />;

    return (
        <div className='raster-metrics-bar'>
            <div className='raster-metrics-list'>
                {items.map((item) => (
                    <MetricItem key={item.key} {...item} />
                ))}

                <ToggleOption
                    isVisible={showDislocations}
                    className={`raster-metric-item modifier-result ${showDislocations ? "active" : ""}`}
                    onToggle={onToggleDislocations}
                    label='Dislocation Analysis'
                />

                <ToggleOption
                    isVisible={showStructureAnalysis}
                    className={`raster-metric-item modifier-result ${showStructureAnalysis ? "active" : ""}`}
                    onToggle={onToggleStructureAnalysis || (() => {})}
                    label='Structure Analysis'
                />
            </div>
        </div>
    );
};

export default React.memo(MetricsBar);