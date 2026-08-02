import { addDays, format, subDays } from 'date-fns';
import { useMemo, useState } from 'react';
import type { FocusEvent, MouseEvent } from 'react';
import type { HeatmapValue } from 'react-calendar-heatmap';
import type { DailyActivity } from '@volt/contracts/modules/daily-activity/domain';
import type { DailyActivityHeatmapDetailEntry } from '@/modules/daily-activity/contracts/heatmap';

export interface ActivityHeatmapChartDataItem extends HeatmapValue {
    date: string;
    count: number;
    level: number;
    data?: {
        activity: DailyActivityHeatmapDetailEntry[];
        minutesOnline: number;
    };
};

interface UseActivityHeatmapParams {
    data: DailyActivity[];
    range: number;
};

interface TooltipState {
    activity: DailyActivityHeatmapDetailEntry[];
    dateLabel: string;
    minutesOnline: number;
    score: number;
};

const ACTIVITY_HEATMAP_LEGEND = [
    {
        label: 'No activity',
        className: 'color-empty'
    },
    {
        label: 'Low',
        className: 'color-scale-1'
    },
    {
        label: 'Moderate',
        className: 'color-scale-2'
    },
    {
        label: 'High',
        className: 'color-scale-3'
    },
    {
        label: 'Peak',
        className: 'color-scale-4'
    }
];

const getDateLabel = (date: string): string => {
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }).format(new Date(date));
};

const getDayAriaLabel = (value: ActivityHeatmapChartDataItem | null): string => {
    if (!value) {
        return 'No activity data available for this day.';
    }

    const dateLabel = getDateLabel(value.date);
    const actionsCount = value.data?.activity.length ?? 0;
    const minutesOnline = value.data?.minutesOnline ?? 0;

    if (!actionsCount && !minutesOnline) {
        return `${dateLabel}: no recorded activity.`;
    }

    return `${dateLabel}: ${actionsCount} activities and ${minutesOnline.toLocaleString()} minutes online.`;
};

const getUserDisplayName = (user: DailyActivity['user']): string => {
    if (typeof user === 'string') {
        return 'Unknown user';
    }

    return `${user.firstName} ${user.lastName}`.trim();
};

const createTooltipState = (value: ActivityHeatmapChartDataItem | null): TooltipState => {
    return {
        activity: value?.data?.activity ?? [],
        dateLabel: value ? getDateLabel(value.date) : 'No date selected',
        minutesOnline: value?.data?.minutesOnline ?? 0,
        score: value?.count ?? 0
    };
};

const buildChartData = (
    data: DailyActivity[],
    range: number,
    startDate: Date
): ActivityHeatmapChartDataItem[] => {
    const dataMap = new Map<string, DailyActivity[]>();

    data.forEach((item) => {
        const dateKey = new Date(item.date).toISOString().split('T')[0];
        const existingItems = dataMap.get(dateKey);

        if (existingItems) {
            existingItems.push(item);
            return;
        }

        dataMap.set(dateKey, [item]);
    });

    const days: ActivityHeatmapChartDataItem[] = [];
    let maxScore = 0;

    for(let index = 0; index <= range; index++){
        const date = addDays(startDate, index);
        const dateKey = format(date, 'yyyy-MM-dd');
        const items = dataMap.get(dateKey) ?? [];
        const dayData = items.length > 0
            ? {
                activity: items.flatMap((item) => {
                    return item.activity.map((activityItem) => ({
                        ...activityItem,
                        userDisplayName: getUserDisplayName(item.user)
                    }));
                }),
                minutesOnline: items.reduce((total, item) => total + item.minutesOnline, 0)
            }
            : undefined;

        let score = 0;
        if(dayData){
            score = (dayData.activity.length * 2) + Math.floor(dayData.minutesOnline / 20);
            maxScore = Math.max(maxScore, score);
        }

        days.push({
            date: dateKey,
            count: score,
            data: dayData,
            level: 0
        });
    }

    days.forEach((day) => {
        if(!day.count || !maxScore){
            return;
        }

        const ratio = day.count / maxScore;
        day.level = ratio > 0.75 ? 4 : ratio > 0.5 ? 3 : ratio > 0.25 ? 2 : 1;
    });

    return days;
};

const useActivityHeatmap = ({ data, range }: UseActivityHeatmapParams) => {
    const today = useMemo(() => new Date(), []);
    const startDate = useMemo(() => subDays(today, range), [today, range]);

    const [tooltipOpen, setTooltipOpen] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({
        x: 0,
        y: 0
    });
    const [tooltipState, setTooltipState] = useState<TooltipState>(() => createTooltipState(null));

    const chartData = useMemo(
        () => buildChartData(data, range, startDate),
        [data, range, startDate]
    );

    const handleDayActivate = (
        event: MouseEvent<SVGRectElement> | FocusEvent<SVGRectElement>,
        value: ActivityHeatmapChartDataItem | null
    ) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setTooltipPos({
            x: rect.left + (rect.width / 2),
            y: rect.top
        });
        setTooltipState(createTooltipState(value));
        setTooltipOpen(true);
    };

    const handleMouseLeave = () => {
        setTooltipOpen(false);
    };

    const handleMouseMove = (event: MouseEvent) => {
        setTooltipPos({
            x: event.clientX,
            y: event.clientY
        });
    };

    return {
        chartData,
        legendItems: ACTIVITY_HEATMAP_LEGEND,
        today,
        startDate,
        tooltipOpen,
        tooltipPos,
        tooltipState,
        getDayAriaLabel,
        handleDayActivate,
        handleMouseLeave,
        handleMouseMove
    };
};

export default useActivityHeatmap;
