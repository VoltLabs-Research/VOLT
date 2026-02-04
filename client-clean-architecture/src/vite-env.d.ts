/// <reference types="vite/client" />
import '@react-three/fiber';

interface ImportMetaEnv{
    readonly VITE_API_URL: string;
}

interface ImportMeta{
    readonly env: ImportMetaEnv;
}

declare module 'react-calendar-heatmap' {
    import { ComponentType, ReactElement } from 'react';

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
        onMouseOver?: (event: React.MouseEvent, value: HeatmapValue | null) => void;
        onMouseLeave?: (event: React.MouseEvent, value: HeatmapValue | null) => void;
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