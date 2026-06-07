import useActivityHeatmap from '@/modules/daily-activity/hooks/use-activity-heatmap';
import ActivityTooltipContent from '@/modules/daily-activity/components/ActivityTooltipContent';
import { CursorTooltip, Box, Row, Stack, Text } from '@voltstack/bravais';
import 'react-calendar-heatmap/dist/styles.css';
import React from 'react';
import CalendarHeatmap from 'react-calendar-heatmap';
import type { DailyActivity } from '@/modules/daily-activity/api/entities/daily-activity';
import type { ActivityHeatmapChartDataItem } from '@/modules/daily-activity/hooks/use-activity-heatmap';
import type { FocusEvent, FocusEventHandler, MouseEvent, MouseEventHandler, ReactElement } from 'react';
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
    onFocus?: FocusEventHandler<SVGRectElement>;
    onBlur?: FocusEventHandler<SVGRectElement>;
    tabIndex?: number;
    role?: string;
    'aria-label'?: string;
};

const isActivityHeatmapChartDataItem = (value: HeatmapValue | null): value is ActivityHeatmapChartDataItem => {
    return value !== null && typeof value.date === 'string' && typeof value.level === 'number' && typeof value.count === 'number';
};

const ActivityHeatmap = ({ data, range = 365 }: ActivityHeatmapProps) => {
    const {
        chartData,
        legendItems,
        today,
        startDate,
        tooltipOpen,
        tooltipPos,
        tooltipState,
        getDayAriaLabel,
        handleMouseEnter,
        handleDayFocus,
        handleMouseLeave,
        handleMouseMove
    } = useActivityHeatmap({ data, range });

    return (
        <Stack gap='075' height='max' className='activity-heatmap-root' role='group' aria-label='Daily activity heatmap'>
            <Box className='activity-heatmap-scroller'>
                <Box height='max' className='activity-heatmap-container'>
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
                                onMouseMove: handleMouseMove,
                                onFocus: (event: FocusEvent<SVGRectElement>) => handleDayFocus(event, chartValue),
                                onBlur: handleMouseLeave,
                                tabIndex: 0,
                                role: 'img',
                                'aria-label': getDayAriaLabel(chartValue)
                            });
                        }}
                    />
                </Box>
            </Box>
            <Row gap='075' wrap className='activity-heatmap-legend'>
                {legendItems.map((item) => (
                    <Row key={item.className} gap='05' className='activity-heatmap-legend-item'>
                        <span className={`activity-heatmap-legend-swatch ${item.className}`} aria-hidden='true' />
                        <Text size='sm' tone='secondary'>{item.label}</Text>
                    </Row>
                ))}
            </Row>
            <Text size='sm' tone='muted' className='activity-heatmap-helper'>Focus or hover a day to inspect activity details.</Text>
            <CursorTooltip
                isOpen={tooltipOpen}
                x={tooltipPos.x}
                y={tooltipPos.y}
                content={(
                    <ActivityTooltipContent
                        activity={tooltipState.activity}
                        dateLabel={tooltipState.dateLabel}
                        minutesOnline={tooltipState.minutesOnline}
                        score={tooltipState.score}
                    />
                )}
            />
        </Stack>
    );
};

export default ActivityHeatmap;
