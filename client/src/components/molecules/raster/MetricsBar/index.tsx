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
    if (!iconName) return undefined;
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
    if (isLoading) return <MetricsBarSkeleton count={4} />;

    return (
        <div className='raster-metrics-bar'>
            <div className='raster-metrics-list'>
                {items.map((item) => (
                    <MetricItem key={item.key} {...item} />
                ))}

                {availableExposures.map((exposure) => {
                    const Icon = resolveIcon(exposure.icon);

                    return (
                        <ToggleOption
                            key={exposure.exposureId}
                            isVisible={!!activeExposures[exposure.exposureId]}
                            className={`raster-metric-item modifier-result ${activeExposures[exposure.exposureId] ? "active" : ""}`}
                            onToggle={() => onToggleExposure(exposure.exposureId)}
                            label={exposure.displayName}
                            // @ts-ignore
                            icon={Icon}
                        />
                    );
                })}

                {tools.map((tool) => {
                    // If tool has an icon name, resolve it. 
                    // Note: You might need to add icons to the tool definition or resolve them in parent.
                    // For now assuming tool.icon is a string name like exposures.
                    const Icon = resolveIcon(tool.icon);

                    return (
                        <ToggleOption
                            key={tool.id}
                            isVisible={tool.isActive}
                            className={`raster-metric-item modifier-result ${tool.isActive ? "active" : ""}`}
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