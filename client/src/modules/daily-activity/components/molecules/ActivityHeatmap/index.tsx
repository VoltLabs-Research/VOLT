import useActivityHeatmap from '@/modules/daily-activity/hooks/use-activity-heatmap';
import ActivityTooltipContent from '@/modules/daily-activity/components/atoms/ActivityTooltipContent';
import Container from '@/shared/presentation/components/Container';
import CursorTooltip from '@/shared/presentation/components/CursorTooltip';
import 'react-calendar-heatmap/dist/styles.css';
import React from 'react';
import CalendarHeatmap from 'react-calendar-heatmap';
import type { DailyActivity } from '@/modules/daily-activity/api/entities/daily-activity';
import type { ActivityHeatmapChartDataItem } from '@/modules/daily-activity/hooks/use-activity-heatmap';
import type { MouseEvent, MouseEventHandler, ReactElement } from 'react';
import type { HeatmapValue } from 'react-calendar-heatmap';
import './ActivityHeatmap.css';

interface ActivityHeatmapProps {
    data: DailyActivity[];
    range?: number;
};

interface DayElementProps {
    onMouseEnter?: MouseEventHandler<SVGRectElement>;
    onMouseLeave?: MouseEventHandler<SVGRectElement>;
    onMouseMove?: MouseEventHandler<SVGRectElement>;
};

const isActivityHeatmapChartDataItem = (value: HeatmapValue | null): value is ActivityHeatmapChartDataItem => {
    return value !== null && typeof value.date === 'string' && typeof value.level === 'number' && typeof value.count === 'number';
};

const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ data, range = 365 }) => {
    const {
        chartData,
        today,
        startDate,
        tooltipOpen,
        tooltipPos,
        tooltipActivity,
        handleMouseEnter,
        handleMouseLeave,
        handleMouseMove
    } = useActivityHeatmap({ data, range });

    return (
        <Container className='activity-heatmap-container h-max'>
            <CalendarHeatmap
                startDate={startDate}
                endDate={today}
                values={chartData}
                classForValue={(value: HeatmapValue | null) => {
                    if (!isActivityHeatmapChartDataItem(value) || value.count === 0) return 'color-empty';
                    return `color-scale-${Math.min(value.level, 4)}`;
                }}
                showWeekdayLabels={false}
                gutterSize={5}
                transformDayElement={(element: ReactElement, value: HeatmapValue | null, _index: number) => {
                    const chartValue = isActivityHeatmapChartDataItem(value) ? value : null;

                    if (!React.isValidElement<DayElementProps>(element)) {
                        return element;
                    }

                    return React.cloneElement(element, {
                        onMouseEnter: (event: MouseEvent<SVGRectElement>) => handleMouseEnter(event, chartValue),
                        onMouseLeave: handleMouseLeave,
                        onMouseMove: handleMouseMove
                    });
                }}
            />
            <CursorTooltip
                isOpen={tooltipOpen}
                x={tooltipPos.x}
                y={tooltipPos.y}
                content={<ActivityTooltipContent activity={tooltipActivity} />}
            />
        </Container>
    );
};

export default ActivityHeatmap;
