import { addDays, format, getDay, subDays } from 'date-fns';
import { useMemo } from 'react';
import type { DailyActivity } from '@volt/contracts/modules/daily-activity/domain';
import type { DailyActivityHeatmapDetailEntry } from '@/modules/daily-activity/contracts/heatmap';

interface ActivityHeatmapDayData {
    activity: DailyActivityHeatmapDetailEntry[];
    minutesOnline: number;
};

interface ActivityHeatmapDay {
    date: string;
    count: number;
    level: number;
    data?: ActivityHeatmapDayData;
};

interface ActivityHeatmapCell {
    key: string;
    day: ActivityHeatmapDay | null;
};

interface ActivityHeatmapWeek {
    key: string;
    monthLabel: string;
};

interface ActivityHeatmapTooltipState {
    activity: DailyActivityHeatmapDetailEntry[];
    dateLabel: string;
    minutesOnline: number;
    score: number;
};

const DAYS_PER_WEEK = 7;

const ACTIVITY_HEATMAP_LEGEND: { label: string; level: number }[] = [
    {
        label: 'No activity',
        level: 0
    },
    {
        label: 'Low',
        level: 1
    },
    {
        label: 'Moderate',
        level: 2
    },
    {
        label: 'High',
        level: 3
    },
    {
        label: 'Peak',
        level: 4
    }
];

const getDateLabel = (date: string): string => {
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }).format(new Date(date));
};

export const getDayAriaLabel = (value: ActivityHeatmapDay | null): string => {
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

export const getDayTooltipState = (value: ActivityHeatmapDay | null): ActivityHeatmapTooltipState => {
    return {
        activity: value?.data?.activity ?? [],
        dateLabel: value ? getDateLabel(value.date) : 'No date selected',
        minutesOnline: value?.data?.minutesOnline ?? 0,
        score: value?.count ?? 0
    };
};

const getUserDisplayName = (user: DailyActivity['user']): string => {
    if (typeof user === 'string') {
        return 'Unknown user';
    }

    return `${user.firstName} ${user.lastName}`.trim();
};

const buildDays = (
    data: DailyActivity[],
    range: number,
    startDate: Date
): ActivityHeatmapDay[] => {
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

    const days: ActivityHeatmapDay[] = [];
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

const buildCells = (days: ActivityHeatmapDay[], leadingBlankCount: number): ActivityHeatmapCell[] => {
    const cells: ActivityHeatmapCell[] = [];

    for(let index = 0; index < leadingBlankCount; index++){
        cells.push({
            key: `leading-${index}`,
            day: null
        });
    }

    days.forEach((day) => {
        cells.push({
            key: day.date,
            day
        });
    });

    while(cells.length % DAYS_PER_WEEK !== 0){
        cells.push({
            key: `trailing-${cells.length}`,
            day: null
        });
    }

    return cells;
};

const buildWeeks = (gridStartDate: Date, weekCount: number): ActivityHeatmapWeek[] => {
    const weeks: ActivityHeatmapWeek[] = [];
    let previousMonth = -1;

    for(let index = 0; index < weekCount; index++){
        const columnStartDate = addDays(gridStartDate, index * DAYS_PER_WEEK);
        const month = columnStartDate.getMonth();

        weeks.push({
            key: format(columnStartDate, 'yyyy-MM-dd'),
            monthLabel: index > 0 && month !== previousMonth ? format(columnStartDate, 'MMM') : ''
        });

        previousMonth = month;
    }

    return weeks;
};

interface UseActivityHeatmapParams {
    data: DailyActivity[];
    range: number;
};

const useActivityHeatmap = ({ data, range }: UseActivityHeatmapParams) => {
    const today = useMemo(() => new Date(), []);
    const startDate = useMemo(() => subDays(today, range), [today, range]);

    const cells = useMemo(() => {
        return buildCells(buildDays(data, range, startDate), getDay(startDate));
    }, [data, range, startDate]);

    const weeks = useMemo(() => {
        return buildWeeks(subDays(startDate, getDay(startDate)), cells.length / DAYS_PER_WEEK);
    }, [cells.length, startDate]);

    return {
        cells,
        weeks,
        legendItems: ACTIVITY_HEATMAP_LEGEND
    };
};

export default useActivityHeatmap;
