/**
 * StatisticsResults - Generic component for displaying grouped statistics with colors
 * Driven by manifest configuration
 */

import React from 'react';
import EditorWidget from '@/components/organisms/scene/EditorWidget';
import type { RasterConfig } from '@/types/stores/plugins';
import './StatisticsResults.css';
import Title from '@/components/primitives/Title';

export interface StatisticsResultsProps {
    data: any;
    config: RasterConfig;
}

const StatisticsResults: React.FC<StatisticsResultsProps> = ({ data, config }) => {
    // Transform data if it's an object with keys as type names
    const processData = (): any[] => {
        // Check if data has structure_types(from C++ backend structure statistics)
        if (data?.structure_types && typeof data.structure_types === 'object') {
            // Transform structure_types object into array format
            // Example: { FCC: { count: 500, percentage: 50.0 }, HCP: { count: 300, percentage: 30.0 } }
            // becomes: [{ name: 'FCC', count: 500, percentage: 50.0 }, { name: 'HCP', count: 300, percentage: 30.0 }]
            return Object.entries(data.structure_types).map(([name, typeInfo]: [string, any]) => ({
                name,
                count: typeInfo.count || 0,
                percentage: typeInfo.percentage || 0
            }));
        }

        // Check if data has a 'types' or 'statistics' array already
        if (data?.types || data?.statistics || data?.groups) {
            return data.types || data.statistics || data.groups;
        }

        // Otherwise, transform object keys into statistics
        // Example: { FCC: [...], HCP: [...], OTHER: [...] }
        // becomes: [{ name: 'FCC', count: X, percentage: Y }, ...]
        if (typeof data === 'object' && !Array.isArray(data)) {
            const entries = Object.entries(data).filter(([_key, value]) =>
                Array.isArray(value) || typeof value === 'number'
            );

            // Calculate total
            const total = entries.reduce((sum, [_, value]) => {
                const count = Array.isArray(value) ? value.length : (typeof value === 'number' ? value : 0);
                return sum + count;
            }, 0);

            // Transform to statistics format
            return entries.map(([name, value]) => {
                const count = Array.isArray(value) ? value.length : (typeof value === 'number' ? value : 0);
                const percentage = total > 0 ? (count / total) * 100 : 0;

                return {
                    name,
                    count,
                    percentage
                };
            });
        }

        return [];
    };

    const stats = processData();

    // Get colors from config or use defaults
    const getColor = (name: string): string => {
        if (config.colors) {
            const normalized = name.toUpperCase().replace(/ /g, '_');
            return config.colors[normalized] || config.colors['DEFAULT'] || '#6b7280';
        }
        return '#6b7280';
    };

    // Format numbers
    const formatNumber = (num: number, format?: string): string => {
        if (typeof num !== 'number' || isNaN(num)) return 'N/A';

        switch (format) {
            case 'percentage':
                return `${num.toFixed(2)}%`;
            case 'decimal':
                return num.toFixed(2);
            default:
                return num.toLocaleString();
        }
    };

    // Sort stats if configured
    const sortedStats = config.sortBy
        ? [...stats].sort((a, b) => {
            const aVal = a[config.sortBy!];
            const bVal = b[config.sortBy!];
            return config.sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        })
        : stats;

    // Limit number of items if configured
    const displayStats = config.maxItems
        ? sortedStats.slice(0, config.maxItems)
        : sortedStats;

    return (
        <EditorWidget draggable={false} className='statistics-results-container'>
            {config.title && (
                <div className='statistics-results-header'>
                    <Title className='font-size-3 statistics-results-title'>{config.title}</Title>
                </div>
            )}

            <div className='statistics-type-legend'>
                {displayStats.map((stat: any, index: number) => {
                    const name = stat[config.nameKey || 'name'] || `Item ${index + 1}`;
                    const value = stat[config.valueKey || 'count'];
                    const percentage = stat[config.percentageKey || 'percentage'];

                    return (
                        <div key={`${name}-${index}`} className='type-legend-item'>
                            <div
                                style={{ backgroundColor: getColor(name) }}
                                className='type-legend-color'
                            />
                            <span className='type-legend-text'>
                                {name}
                                {value !== undefined && ` (${formatNumber(value)})`}
                                {percentage !== undefined && ` - ${formatNumber(percentage, 'percentage')}`}
                            </span>
                        </div>
                    );
                })}
            </div>

            {config.showSummary && data?.total && (
                <div className='statistics-summary'>
                    <div className='summary-item'>
                        <span className='summary-label'>Total:</span>
                        <span className='summary-value'>{formatNumber(data.total)}</span>
                    </div>
                </div>
            )}
        </EditorWidget>
    );
};

export default StatisticsResults;
