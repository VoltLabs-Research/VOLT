declare module 'react-calendar-heatmap' {
    export interface CalendarHeatmapProps {
        values: any[];
        startDate: Date | string | number;
        endDate: Date | string | number;
        gutterSize?: number;
        horizontal?: boolean;
        showMonthLabels?: boolean;
        showWeekdayLabels?: boolean;
        monthLabels?: string[];
        weekdayLabels?: string[];
        onMouseOver?: (e: any, value: any) => void;
        onMouseLeave?: (e: any, value: any) => void;
        onClick?: (value: any) => void;
        classForValue?: (value: any) => string;
        tooltipDataAttrs?: (value: any) => object;
        titleForValue?: (value: any) => string;
        transformDayElement?: (element: any, value: any, index: number) => React.ReactNode;
    }

    export default class CalendarHeatmap extends React.Component<CalendarHeatmapProps> { }
}
