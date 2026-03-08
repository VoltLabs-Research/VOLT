import React, { type ReactElement, type SVGProps } from 'react';
import CalendarHeatmap, { type HeatmapValue } from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import Container from '@/shared/presentation/components/Container';
import CursorTooltip from '@/shared/presentation/components/CursorTooltip';
import type { DailyActivity } from '@/modules/daily-activity/api/entities/daily-activity';
import useActivityHeatmap, { type ActivityHeatmapChartDataItem } from '@/modules/daily-activity/hooks/use-activity-heatmap';
import './ActivityHeatmap.css';

interface ActivityHeatmapProps {
    data: DailyActivity[];
    range?: number;
}

type DayElement = ReactElement<SVGProps<SVGRectElement>>;

const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ data, range = 365 }) => {
    const {
        chartData,
        today,
        startDate,
        tooltipOpen,
        tooltipPos,
        tooltipContent,
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
                    if(!value || (value as ActivityHeatmapChartDataItem).count === 0) return 'color-empty';
                    return `color-scale-${Math.min((value as ActivityHeatmapChartDataItem).level, 4)}`;
                }}
                showWeekdayLabels={false}
                gutterSize={5}
                transformDayElement={(element: ReactElement, value: HeatmapValue | null, _index: number) => {
                    return React.cloneElement(element as DayElement, {
                        onMouseEnter: (e: React.MouseEvent) => handleMouseEnter(e, value as ActivityHeatmapChartDataItem | null),
                        onMouseLeave: handleMouseLeave,
                        onMouseMove: handleMouseMove
                    });
                }}
            />
            <CursorTooltip
                isOpen={tooltipOpen}
                x={tooltipPos.x}
                y={tooltipPos.y}
                content={tooltipContent}
            />
        </Container>
    );
};

export default ActivityHeatmap;
