import Logger from "@/services/common/logger";

const formatTimeAgo = (timestampStr: string): string => {
    const logger = new Logger('format-time-ago');
    const date = new Date(timestampStr);

    if(isNaN(date.getTime())){
        logger.error('Invalid timestamp string provided:', timestampStr);
        return 'Invalid date';
    }

    const now = new Date();
    const secondsPast = (now.getTime() - date.getTime()) / 1000;

    // if secondsPast < 0, then in the future

    if(secondsPast < 60){
        return 'just now';
    }

    const intervals: { label: string, seconds: number }[] = [
        { label: 'year', seconds: 31536000 },
        { label: 'month', seconds: 2592000 },
        { label: 'week', seconds: 604800 },
        { label: 'day', seconds: 86400 },
        { label: 'hour', seconds: 3600 },
        { label: 'min', seconds: 60 }
    ];

    for(const interval of intervals){
        const count = Math.floor(secondsPast / interval.seconds);
        if(count >= 1){
            // Add an 's' for plural, except for 'just now'
            const plural = count > 1 ? 's' : '';
            return `${count} ${interval.label}${plural} ago`;
        }
    }

    // fallback
    return 'just now';
};

export default formatTimeAgo;
