import { addDays, format, subDays } from 'date-fns';
import { useMemo, useState } from 'react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import type { FocusEvent, MouseEvent } from 'react';
import type { HeatmapValue } from 'react-calendar-heatmap';
import type { DailyActivity, DailyActivityHeatmapDetailEntry } from '../api/entities/daily-activity';

interface ActivityHeatmapDayData {
    activity: DailyActivityHeatmapDetailEntry[];
    minutesOnline: number;
};

export interface ActivityHeatmapChartDataItem extends HeatmapValue {
    date: string;
    count: number;
    level: number;
    data?: ActivityHeatmapDayData;
};

interface ActivityHeatmapLegendItem {
    label: string;
    className: string;
};

interface UseActivityHeatmapParams {
    data: DailyActivity[];
    range: number;
};

interface TooltipPosition {
    x: number;
    y: number;
};

interface TooltipState {
    activity: DailyActivityHeatmapDetailEntry[];
    dateLabel: string;
    minutesOnline: number;
    score: number;
};

const ACTIVITY_HEATMAP_LEGEND: ActivityHeatmapLegendItem[] = [
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

const getUserId = (user: DailyActivity['user']): string => {
    return typeof user === 'string' ? user : user._id;
};

const getUserDisplayName = (user: DailyActivity['user']): string => {
    if (typeof user === 'string') {
        return 'Unknown user';
    }

    return `${user.firstName} ${user.lastName}`.trim();
};

const toHeatmapDetailEntry = (
    activityItem: DailyActivity['activity'][number],
    user: DailyActivity['user'],
    currentUserId: string | undefined
): DailyActivityHeatmapDetailEntry => {
    const userId = getUserId(user);

    return {
        ...activityItem,
        isCurrentUser: userId === currentUserId,
        user,
        userDisplayName: getUserDisplayName(user),
        userId
    };
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
    startDate: Date,
    currentUserId: string | undefined
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
                    return item.activity.map((activityItem) => {
                        return toHeatmapDetailEntry(activityItem, item.user, currentUserId);
                    });
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

    return days.map((day) => {
        if(day.count === 0 || maxScore === 0){
            return day;
        }

        const ratio = day.count / maxScore;
        let level = 1;

        if(ratio > 0.75) level = 4;
        else if(ratio > 0.5) level = 3;
        else if(ratio > 0.25) level = 2;

        return { ...day, level };
    });
};

const useActivityHeatmap = ({ data, range }: UseActivityHeatmapParams) => {
    const currentUser = useCurrentUser();
    const today = useMemo(() => new Date(), []);
    const startDate = useMemo(() => subDays(today, range), [today, range]);

    const [tooltipOpen, setTooltipOpen] = useState(false);
    const [tooltipPos, setTooltipPos] = useState<TooltipPosition>({ x: 0, y: 0 });
    const [tooltipState, setTooltipState] = useState<TooltipState>(() => createTooltipState(null));

    const chartData = useMemo(
        () => buildChartData(data, range, startDate, currentUser?._id),
        [currentUser?._id, data, range, startDate]
    );

    const legendItems = useMemo(() => ACTIVITY_HEATMAP_LEGEND, []);

    const handleMouseEnter = (event: MouseEvent<SVGRectElement>, value: ActivityHeatmapChartDataItem | null) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setTooltipPos({ x: rect.left + (rect.width / 2), y: rect.top });
        setTooltipState(createTooltipState(value));
        setTooltipOpen(true);
    };

    const handleDayFocus = (event: FocusEvent<SVGRectElement>, value: ActivityHeatmapChartDataItem | null) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setTooltipPos({ x: rect.left + (rect.width / 2), y: rect.top });
        setTooltipState(createTooltipState(value));
        setTooltipOpen(true);
    };

    const handleMouseLeave = () => {
        setTooltipOpen(false);
    };

    const handleMouseMove = (event: MouseEvent) => {
        setTooltipPos({ x: event.clientX, y: event.clientY });
    };

    return {
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
    };
};

export default useActivityHeatmap;
