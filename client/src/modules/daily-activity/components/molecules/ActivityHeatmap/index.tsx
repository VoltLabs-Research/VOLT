import useActivityHeatmap from '@/modules/daily-activity/hooks/use-activity-heatmap';
import ActivityTooltipContent from '@/modules/daily-activity/components/atoms/ActivityTooltipContent';
import Container from '@/shared/presentation/components/Container';
import CursorTooltip from '@/shared/presentation/components/CursorTooltip';
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

const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ data, range = 365 }) => {
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
        <Container className='activity-heatmap-root d-flex column gap-075 h-max' role='group' aria-label='Daily activity heatmap'>
            <Container className='activity-heatmap-scroller'>
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
                                onMouseMove: handleMouseMove,
                                onFocus: (event: FocusEvent<SVGRectElement>) => handleDayFocus(event, chartValue),
                                onBlur: handleMouseLeave,
                                tabIndex: 0,
                                role: 'img',
                                'aria-label': getDayAriaLabel(chartValue)
                            });
                        }}
                    />
                </Container>
            </Container>
            <Container className='activity-heatmap-legend d-flex items-center gap-075 flex-wrap'>
                {legendItems.map((item) => (
                    <Container key={item.className} className='activity-heatmap-legend-item d-flex items-center gap-05'>
                        <span className={`activity-heatmap-legend-swatch ${item.className}`} aria-hidden='true' />
                        <span className='font-size-1 color-secondary'>{item.label}</span>
                    </Container>
                ))}
            </Container>
            <span className='activity-heatmap-helper font-size-1 color-muted'>Focus or hover a day to inspect activity details.</span>
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
        </Container>
    );
};

export default ActivityHeatmap;
