import Box from '@/shared/presentation/primitives/Box';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import { ACTIVITY_ICON, ACTIVITY_ACCENT } from '@/modules/daily-activity/utilities/activity-mappings';
import '@/modules/daily-activity/components/ActivityEntry/ActivityEntry.css';
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
                <Box key={`${item.createdAt}-${index}`} className='activity-entry d-flex items-start gap-05'>
                    <span className='activity-entry-dot d-flex flex-center radius-md f-shrink-0' style={{ color: ACTIVITY_ACCENT[item.type] }}>
                        {ACTIVITY_ICON[item.type]}
                    </span>
                    <Box className='activity-entry-content d-flex column min-w-0'>
                        <Text size='sm' tone='secondary'>
                            {item.userDisplayName} · {timeFormatter.format(new Date(item.createdAt))}
                        </Text>
                        <Text size='md' tone='primary'>{item.description}</Text>
                    </Box>
                </Box>
            ))}
        </Stack>
    );
};

export default ActivityTooltipContent;
