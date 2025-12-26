import React from 'react';
import type { MetricsBarProps } from '@/types/raster';
import MetricsBarSkeleton from '@/components/atoms/raster/MetricsBarSkeleton';
import MetricItem from '@/components/atoms/raster/MetricItem';
import ToggleOption from '@/components/atoms/common/ToggleOption';
import * as Icons from 'react-icons/pi';
import * as HiIcons from 'react-icons/hi2';
import * as RiIcons from 'react-icons/ri';
import * as SiIcons from 'react-icons/si';

// Helper to resolve icon string to component
const resolveIcon = (iconName?: string) => {
    if(!iconName) return undefined;
    // @ts-ignore
    return Icons[iconName] || HiIcons[iconName] || RiIcons[iconName] || SiIcons[iconName];
};

const MetricsBar: React.FC<MetricsBarProps> = ({
    items,
    isLoading,
    availableExposures,
    activeExposures,
    onToggleExposure,
    tools,
    onToggleTool
}) => {
    if(isLoading) return <MetricsBarSkeleton count={4} />;

    return (
        <div className='d-flex items-center gap-075 raster-metrics-bar w-max'>
            <div className='d-flex flex-wrap items-center h-max ml-025 raster-metrics-list h-max'>
                {items.map((item) => (
                    <MetricItem key={item.key} label={item.label} value={item.value} icon={item.icon} />
                ))}

                {tools.map((tool) => {
                    const Icon = resolveIcon(tool.icon);

                    return (
                        <ToggleOption
                            key={tool.id}
                            isVisible={tool.isActive}
                            className={`d-flex items-center gap-05 raster-metric-item modifier-result ${tool.isActive ? "active" : ""} h-max color-primary`}
                            onToggle={() => onToggleTool(tool.id)}
                            label={tool.label}
                            // @ts-ignore
                            icon={Icon}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default React.memo(MetricsBar);
