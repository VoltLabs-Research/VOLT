/**
 * BoxResults - Generic component for displaying metric boxes in raster view
 * Driven by manifest configuration
 */

import React from 'react';
import EditorWidget from '@/components/organisms/scene/EditorWidget';
import type { RasterConfig } from '@/types/stores/plugins';
import './BoxResults.css';

export interface BoxResultsProps {
    data: any;
    config: RasterConfig;
    onItemSelect?: (item: any) => void;
}

const formatValue = (value: any, format?: string, decimals: number = 2): string => {
    if (value === undefined || value === null || (typeof value === 'number' && isNaN(value))) {
        return 'N/A';
    }

    switch (format) {
        case 'number':
            return typeof value === 'number' ? value.toLocaleString() : String(value);
        case 'decimal':
            return typeof value === 'number' ? value.toFixed(decimals) : String(value);
        case 'percentage':
            return typeof value === 'number' ? `${(value * 100).toFixed(decimals)}%` : String(value);
        case 'bytes':
            if (typeof value !== 'number') return String(value);
            const units = ['B', 'KB', 'MB', 'GB'];
            let size = value;
            let unitIndex = 0;
            while (size >= 1024 && unitIndex < units.length - 1) {
                size /= 1024;
                unitIndex++;
            }
            return `${size.toFixed(decimals)} ${units[unitIndex]}`;
        default:
            return String(value);
    }
};

const getValueByPath = (obj: any, path: string): any => {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
};

const BoxResults: React.FC<BoxResultsProps> = ({ data, config, onItemSelect }) => {
    // Extract items array from data
    const items = Array.isArray(data) ? data : (data?.data || data?.items || data?.dislocations || []);

    // Calculate legend stats if enabled
    const legendStats = React.useMemo(() => {
        if (!config.showLegend || !config.legendKey || !Array.isArray(items)) return {};

        return items.reduce((acc, item) => {
            const legendValue = getValueByPath(item, config.legendKey!);
            if (legendValue) {
                acc[legendValue] = (acc[legendValue] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);
    }, [items, config.showLegend, config.legendKey]);

    const getLegendColor = (value: string): string => {
        return config.legendColors?.[value.toLowerCase()] || '#6b7280';
    };

    const getLegendName = (value: string): string => {
        return value.charAt(0).toUpperCase() + value.slice(1);
    };

    return (
        <EditorWidget draggable={false} className='box-results-container'>
            <div className='box-results-header-container'>
                <h3 className='box-results-header-title'>{config.title}</h3>

                {config.showLegend && Object.keys(legendStats).length > 0 && (
                    <div className='box-type-legend'>
                        {Object.entries(legendStats).map(([type, count]) => (
                            <div key={type} className='type-legend-item'>
                                <div
                                    style={{ backgroundColor: getLegendColor(type) }}
                                    className='type-legend-color'
                                />
                                <span className='type-legend-text'>
                                    {getLegendName(type)} ({count})
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className='box-results-body-container'>
                {items.map((item: any, index: number) => {
                    const legendValue = config.legendKey ? getValueByPath(item, config.legendKey) : null;
                    const itemColor = legendValue ? getLegendColor(legendValue) : '#6b7280';
                    const segmentId = item.segmentId ?? index + 1;

                    return (
                        <div
                            key={`${item.segmentId || index}`}
                            className='box-result-item'
                            onClick={() => onItemSelect?.(item)}
                        >
                            {config.legendKey && (
                                <div className='box-result-item-header-container'>
                                    <div
                                        style={{ backgroundColor: itemColor }}
                                        className='box-result-type'
                                    />
                                    <h4 className='box-result-item-title'>
                                        Segment #{segmentId} {legendValue && `(${getLegendName(legendValue)})`}
                                    </h4>
                                </div>
                            )}

                            <div className='box-result-data-container'>
                                {config.metrics?.map((metric) => {
                                    const value = getValueByPath(item, metric.key);
                                    const formattedValue = formatValue(value, metric.format, metric.decimals);

                                    return (
                                        <div key={metric.key} className='box-result-data'>
                                            <span className='data-label'>{metric.label}:</span>
                                            <span className='data-value'>
                                                {formattedValue}
                                                {metric.unit && ` ${metric.unit}`}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Summary section if data has summary fields */}
            {(data?.totalSegments !== undefined || data?.totalLength !== undefined) && (
                <div className='box-results-summary-container'>
                    {data.totalSegments !== undefined && (
                        <div className='box-summary-item'>
                            <span className='box-summary-value'>{data.totalSegments}</span>
                            <span className='box-summary-label'>Total Items</span>
                        </div>
                    )}
                    {data.totalLength !== undefined && (
                        <div className='box-summary-item'>
                            <span className='box-summary-value'>
                                {formatValue(data.totalLength, 'decimal', 1)}
                            </span>
                            <span className='box-summary-label'>Total Length (Å)</span>
                        </div>
                    )}
                    {data.averageSegmentLength !== undefined && (
                        <div className='box-summary-item'>
                            <span className='box-summary-value'>
                                {formatValue(data.averageSegmentLength, 'decimal', 2)}
                            </span>
                            <span className='box-summary-label'>Avg. Length (Å)</span>
                        </div>
                    )}
                </div>
            )}
        </EditorWidget>
    );
};

export default BoxResults;
