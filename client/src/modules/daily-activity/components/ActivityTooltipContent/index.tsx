import ActivityEntry from '@/modules/daily-activity/components/ActivityEntry';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import type { DailyActivityHeatmapDetailEntry } from '@/modules/daily-activity/api/entities/daily-activity';
import { useMemo } from 'react';
import type { FC } from 'react';

interface ActivityTooltipContentProps {
    activity: DailyActivityHeatmapDetailEntry[];
    dateLabel: string;
    minutesOnline: number;
    score: number;
};

const ActivityTooltipContent: FC<ActivityTooltipContentProps> = ({ activity, dateLabel, minutesOnline, score }) => {
    const timeFormatter = useMemo(() => {
        return new Intl.DateTimeFormat(undefined, {
            hour: 'numeric',
            minute: '2-digit'
        });
    }, []);

    if (!activity.length) {
        return (
            <Stack gap='05' className='activity-tooltip-content'>
                <Text size='md' weight='medium' tone='primary'>{dateLabel}</Text>
                <Text tone='secondary' size='md'>No recorded activity for this day.</Text>
            </Stack>
        );
    }

    return (
        <Stack gap='1' overflow='y-scroll' className='activity-tooltip-content'>
            <Stack gap='025'>
                <Text size='md' weight='medium' tone='primary'>{dateLabel}</Text>
                <Text size='sm' tone='secondary'>
                    {activity.length.toLocaleString()} events · {minutesOnline.toLocaleString()} minutes online · score {score.toLocaleString()}
                </Text>
            </Stack>
            {activity.map((item, index) => (
                <ActivityEntry
                    key={`${item.createdAt}-${index}`}
                    type={item.type}
                >
                    <Text size='sm' tone='secondary'>
                        {item.userDisplayName} · {timeFormatter.format(new Date(item.createdAt))}
                    </Text>
                    <Text size='md' tone='primary'>{item.description}</Text>
                </ActivityEntry>
            ))}
        </Stack>
    );
};

export default ActivityTooltipContent;
