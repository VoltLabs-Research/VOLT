import React, { useMemo, useState } from 'react';
import CalendarHeatmap, { type HeatmapValue } from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import { addDays, format, subDays } from 'date-fns';
import Container from '@/shared/presentation/components/Container';
import CursorTooltip from '@/shared/presentation/components/CursorTooltip';
import type { DailyActivity, ActivityItem } from '@/modules/daily-activity/domain/entities';
import './ActivityHeatmap.css';

interface ActivityHeatmapProps {
    data: DailyActivity[];
    range?: number;
}

interface ChartDataItem extends HeatmapValue {
    date: string;
    count: number;
    level: number;
    data?: DailyActivity;
}

const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ data, range = 365 }) => {
    const today = new Date();
    const startDate = subDays(today, range);

    const [tooltipOpen, setTooltipOpen] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [tooltipContent, setTooltipContent] = useState<React.ReactNode>(null);

    const chartData = useMemo(() => {
        const dataMap = new Map<string, DailyActivity>();
        data.forEach((item) => {
            const dateStr = new Date(item.date).toISOString().split('T')[0];
            dataMap.set(dateStr, item);
        });

        const result: ChartDataItem[] = [];
        let maxScore = 0;

        for(let i = 0; i <= range; i++){
            const date = addDays(startDate, i);
            const dateStr = format(date, 'yyyy-MM-dd');
            const item = dataMap.get(dateStr);

            let score = 0;
            const activityCount = item?.activity?.length || 0;
            const minutes = item?.minutesOnline || 0;

            if(item){
                score = (activityCount * 2) + Math.floor(minutes / 20);
            }
            if(score > maxScore) maxScore = score;

            result.push({
                date: dateStr,
                count: score,
                data: item,
                level: 0
            });
        }

        return result.map((day) => {
            let level = 0;
            if(day.count > 0){
                const ratio = maxScore > 0 ? day.count / maxScore : 0;
                if(ratio > 0.75) level = 4;
                else if(ratio > 0.5) level = 3;
                else if(ratio > 0.25) level = 2;
                else level = 1;
            }
            return { ...day, level };
        });
    }, [data, range, startDate]);

    const handleMouseEnter = (e: React.MouseEvent, value: ChartDataItem | null) => {
        const rect = (e.target as Element).getBoundingClientRect();
        setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
        setTooltipOpen(true);

        if(value?.data?.activity?.length){
            setTooltipContent(
                <Container className='d-flex column gap-1 y-scroll activity-tooltip-content'>
                    {value.data.activity.map((act: ActivityItem, idx: number) => (
                        <Container key={idx} className='d-flex column gap-025'>
                            <span className='font-size-1 color-secondary'>
                                {format(new Date(act.createdAt), 'HH:mm')}
                            </span>
                            <span className='font-size-2 color-primary'>{act.description}</span>
                        </Container>
                    ))}
                </Container>
            );
        }else{
            setTooltipContent(
                <span className='color-secondary font-size-2'>No activity</span>
            );
        }
    };

    const handleMouseLeave = () => {
        setTooltipOpen(false);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        setTooltipPos({ x: e.clientX, y: e.clientY });
    };

    return (
        <Container className='activity-heatmap-container h-max'>
            <CalendarHeatmap
                startDate={startDate}
                endDate={today}
                values={chartData}
                classForValue={(value: HeatmapValue | null) => {
                    if(!value || (value as ChartDataItem).count === 0) return 'color-empty';
                    return `color-scale-${Math.min((value as ChartDataItem).level, 4)}`;
                }}
                showWeekdayLabels={false}
                gutterSize={5}
                transformDayElement={(element, value, _index) => {
                    return React.cloneElement(element as React.ReactElement<React.SVGProps<SVGRectElement>>, {
                        onMouseEnter: (e: React.MouseEvent) => handleMouseEnter(e, value as ChartDataItem),
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
