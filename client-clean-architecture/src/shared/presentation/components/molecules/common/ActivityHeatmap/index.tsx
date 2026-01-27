import React, { useMemo } from 'react';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import '@/shared/presentation/components/molecules/common/ActivityHeatmap/ActivityHeatmap.css';
import type { ActivityData } from '@/modules/daily-activity/domain/entities';
import { addDays, format, subDays } from 'date-fns';
import CursorTooltip from '@/shared/presentation/components/atoms/common/CursorTooltip';
import Container from '@/shared/presentation/components/primitives/Container';

interface ActivityHeatmapProps {
    data: ActivityData[];
    range?: number;
}

const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ data, range = 365 }) => {
    const today = new Date();
    const startDate = subDays(today, range);

    const [tooltipOpen, setTooltipOpen] = React.useState(false);
    const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0 });
    const [tooltipContent, setTooltipContent] = React.useState<React.ReactNode>(null);

    const chartData = useMemo(() => {
        const dataMap = new Map<string, ActivityData>();
        data.forEach(item => {
            const dateStr = new Date(item.date).toISOString().split('T')[0];
            dataMap.set(dateStr, item);
        });

        const result = [];
        let maxScore = 0;

        for (let i = 0; i <= range; i++) {
            const date = addDays(startDate, i);
            const dateStr = format(date, 'yyyy-MM-dd');
            const item = dataMap.get(dateStr);

            let score = 0;
            if (item) {
                // Use count directly from simple format, or calculate if using detailed format
                score = item.count;
            }
            if (score > maxScore) maxScore = score;

            result.push({
                date: dateStr,
                count: score,
                data: item
            });
        }

        return result.map(day => {
            // Level is already provided by backend in simple format, or calculate relative
            let level = 0;
            if (day.data && typeof day.data.level === 'number') {
                level = day.data.level;
            } else if (day.count > 0) {
                const ratio = maxScore > 0 ? day.count / maxScore : 0;
                if (ratio > 0.75) level = 4;
                else if (ratio > 0.5) level = 3;
                else if (ratio > 0.25) level = 2;
                else level = 1;
            }
            return { ...day, level };
        });

    }, [data, range]);

    return (
        <div className="activity-heatmap-container h-max">
            <CalendarHeatmap
                startDate={startDate}
                endDate={today}
                values={chartData}
                classForValue={(value: any) => {
                    if (!value || value.count === 0) return 'color-empty';
                    return `color-scale-${Math.min(value.level, 4)}`;
                }}
                showWeekdayLabels={false}
                gutterSize={5}
                transformDayElement={(element: any, value: any) => {
                    return React.cloneElement(element, {
                        onMouseEnter: (e: React.MouseEvent) => {
                            const rect = (e.target as Element).getBoundingClientRect();
                            setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                            setTooltipOpen(true);

                            // @ts-ignore
                            if (value?.data?.activity?.length) {
                                setTooltipContent(
                                    <Container className='d-flex column gap-1'>
                                        {/* @ts-ignore */}
                                        {value.data.activity.map((act: any, idx: number) => (
                                            <div key={idx} className="team-activity-item d-flex column gap-025 y-scroll">
                                                <div className="team-activity-time color-secondary">{format(new Date(act.createdAt), 'HH:mm')}</div>
                                                <div className="team-activity-desc">{act.description}</div>
                                            </div>
                                        ))}
                                    </Container>
                                );
                            } else if (value?.count > 0) {
                                setTooltipContent(
                                    <Container className='d-flex column center items-center gap-025'>
                                        <div className="font-weight-6">Activity</div>
                                        <div>{value.count} events</div>
                                    </Container>
                                );
                            } else {
                                setTooltipContent(
                                    <div className="no-activity">No activity</div>
                                );
                            }
                        },
                        onMouseLeave: () => {
                            setTooltipOpen(false);
                        },
                        onMouseMove: (e: React.MouseEvent) => {
                            setTooltipPos({ x: e.clientX, y: e.clientY });
                        }
                    });
                }}
            />
            <CursorTooltip
                isOpen={tooltipOpen}
                x={tooltipPos.x}
                y={tooltipPos.y}
                content={tooltipContent}
                className={tooltipContent && (tooltipContent as any).props?.className === 'no-activity' ? 'no-activity-wrapper' : ''}
            />
        </div>
    );
};

export default ActivityHeatmap;
