import React, { useEffect, useMemo } from 'react';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import '@/components/molecules/common/ActivityHeatmap/ActivityHeatmap.css';
import { type ActivityData } from '@/features/team/api/team';
import { addDays, format, subDays } from 'date-fns';
import CursorTooltip from '@/components/atoms/common/CursorTooltip';
import Container from '@/components/primitives/Container';

interface ActivityHeatmapProps {
    data: ActivityData[];
    range?: number;
}

const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ data, range = 365 }) => {
    const today = new Date();
    const startDate = subDays(today, range);

    // Tooltip state
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
            // Activity count heuristic
            const activityCount = item?.activity?.length || 0;
            const minutes = item?.minutesOnline || 0;

            if (item) {
                // Heuristic: each activity is 2 points, 60 mins online is 1 point
                score = (activityCount * 2) + Math.floor(minutes / 20);
            }
            if (score > maxScore) maxScore = score;

            result.push({
                date: dateStr,
                count: score,
                data: item
            });
        }

        return result.map(day => {
            let level = 0;
            if (day.count > 0) {
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
                classForValue={(value) => {
                    if (!value || value.count === 0) return 'color-empty';
                    return `color-scale-${Math.min(value.level, 4)}`;
                }}
                showWeekdayLabels={false}
                gutterSize={5}
                transformDayElement={(element, value, index) => {
                    return React.cloneElement(element, {
                        onMouseEnter: (e: React.MouseEvent) => {
                            const rect = (e.target as Element).getBoundingClientRect();
                            setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                            setTooltipOpen(true);

                            if (value?.data?.activity?.length) {
                                setTooltipContent(
                                    <Container className='d-flex column gap-1'>
                                        {value.data.activity.map((act: any, idx: number) => (
                                            <div key={idx} className="team-activity-item d-flex column gap-025 y-scroll">
                                                <div className="team-activity-time color-secondary">{format(new Date(act.createdAt), 'HH:mm')}</div>
                                                <div className="team-activity-desc">{act.description}</div>
                                            </div>
                                        ))}
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
                            // Optional: follow cursor exactly? User said "de acuerdo a la posicion del cursor".
                            // If we want exact cursor follow:
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
