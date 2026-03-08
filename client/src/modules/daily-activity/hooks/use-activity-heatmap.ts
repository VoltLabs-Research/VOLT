import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { addDays, format, subDays } from 'date-fns';
import type { HeatmapValue } from 'react-calendar-heatmap';
import formatActivityTooltip from '../utilities/format-activity-tooltip';
import type { DailyActivity } from '../api/entities/daily-activity';

export interface ActivityHeatmapChartDataItem extends HeatmapValue {
    date: string;
    count: number;
    level: number;
    data?: DailyActivity;
}

interface UseActivityHeatmapParams {
    data: DailyActivity[];
    range: number;
}

interface TooltipPosition {
    x: number;
    y: number;
}

const buildChartData = (
    data: DailyActivity[],
    range: number,
    startDate: Date
): ActivityHeatmapChartDataItem[] => {
    const dataMap = new Map<string, DailyActivity>();
    data.forEach((item) => {
        const dateKey = new Date(item.date).toISOString().split('T')[0];
        dataMap.set(dateKey, item);
    });

    const days: ActivityHeatmapChartDataItem[] = [];
    let maxScore = 0;

    for(let index = 0; index <= range; index++){
        const date = addDays(startDate, index);
        const dateKey = format(date, 'yyyy-MM-dd');
        const item = dataMap.get(dateKey);

        let score = 0;
        if(item){
            score = (item.activity.length * 2) + Math.floor(item.minutesOnline / 20);
            maxScore = Math.max(maxScore, score);
        }

        days.push({
            date: dateKey,
            count: score,
            data: item,
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
    const today = useMemo(() => new Date(), []);
    const startDate = useMemo(() => subDays(today, range), [today, range]);

    const [tooltipOpen, setTooltipOpen] = useState(false);
    const [tooltipPos, setTooltipPos] = useState<TooltipPosition>({ x: 0, y: 0 });
    const [tooltipContent, setTooltipContent] = useState<ReactNode>(null);

    const chartData = useMemo(
        () => buildChartData(data, range, startDate),
        [data, range, startDate]
    );

    const handleMouseEnter = (event: MouseEvent, value: ActivityHeatmapChartDataItem | null) => {
        const rect = (event.target as Element).getBoundingClientRect();
        setTooltipPos({ x: rect.left + (rect.width / 2), y: rect.top });
        setTooltipContent(formatActivityTooltip(value?.data?.activity ?? []));
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
        today,
        startDate,
        tooltipOpen,
        tooltipPos,
        tooltipContent,
        handleMouseEnter,
        handleMouseLeave,
        handleMouseMove
    };
};

export default useActivityHeatmap;
