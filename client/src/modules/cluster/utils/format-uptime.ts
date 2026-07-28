import { formatDuration } from '@voltstack/bravais';

const SECONDS_PER_MINUTE = 60;

export const formatUptime = (seconds: number): string => {
    return formatDuration(seconds / SECONDS_PER_MINUTE);
};
