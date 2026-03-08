declare module 'react-calendar-heatmap' {
    import type { ComponentType, MouseEvent, ReactElement } from 'react';

    export interface HeatmapValue {
        date: string | Date;
        count?: number;
        [key: string]: unknown;
    }

    export interface CalendarHeatmapProps {
        values: HeatmapValue[];
        startDate: Date | string;
        endDate: Date | string;
        classForValue?: (value: HeatmapValue | null) => string;
        titleForValue?: (value: HeatmapValue | null) => string;
        tooltipDataAttrs?: (value: HeatmapValue | null) => Record<string, string>;
        onClick?: (value: HeatmapValue | null) => void;
        onMouseOver?: (event: MouseEvent, value: HeatmapValue | null) => void;
        onMouseLeave?: (event: MouseEvent, value: HeatmapValue | null) => void;
        showWeekdayLabels?: boolean;
        showMonthLabels?: boolean;
        showOutOfRangeDays?: boolean;
        horizontal?: boolean;
        gutterSize?: number;
        monthLabels?: string[];
        weekdayLabels?: string[];
        transformDayElement?: (
            element: ReactElement,
            value: HeatmapValue | null,
            index: number
        ) => ReactElement;
    }

    const CalendarHeatmap: ComponentType<CalendarHeatmapProps>;
    export default CalendarHeatmap;
}
