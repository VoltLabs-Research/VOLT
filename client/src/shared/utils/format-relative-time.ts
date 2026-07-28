const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DEFAULT_RELATIVE_DAY_LIMIT = 7;

// `date-fns` cannot produce this form: `formatDistanceToNowStrict` with
// `addSuffix` renders '5 minutes ago', not '5m ago'. `Intl.RelativeTimeFormat`
// with `style: 'narrow'` emits the compact form natively and localises it.
const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat('en', {
    numeric: 'always',
    style: 'narrow'
});

interface CompactRelativeTimeOptions {
    /** Returned when the value is missing or is not a parseable date. */
    fallback?: string;
    /** Values older than this many days render through `formatAbsolute` instead. */
    relativeDayLimit?: number;
    /** Renders values that fall outside `relativeDayLimit`. */
    formatAbsolute?: (date: Date) => string;
}

const formatAbsoluteDefault = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
};

/**
 * Compact relative time: '5m ago', '2h ago', '3d ago'.
 *
 * Values under a minute old render as 'Just now'. Values beyond
 * `relativeDayLimit` render as an absolute date instead.
 */
export const formatCompactRelativeTime = (
    dateValue: string | null | undefined,
    options: CompactRelativeTimeOptions = {}
): string => {
    const {
        fallback = '—',
        relativeDayLimit = DEFAULT_RELATIVE_DAY_LIMIT,
        formatAbsolute = formatAbsoluteDefault
    } = options;

    if(!dateValue) return fallback;

    const date = new Date(dateValue);
    const then = date.getTime();
    if(!Number.isFinite(then)) return fallback;

    const diffMinutes = Math.floor((Date.now() - then) / MS_PER_MINUTE);
    if(diffMinutes < 1) return 'Just now';
    if(diffMinutes < MINUTES_PER_HOUR) return RELATIVE_TIME_FORMATTER.format(-diffMinutes, 'minute');

    const diffHours = Math.floor(diffMinutes / MINUTES_PER_HOUR);
    if(diffHours < HOURS_PER_DAY) return RELATIVE_TIME_FORMATTER.format(-diffHours, 'hour');

    const diffDays = Math.floor(diffHours / HOURS_PER_DAY);
    if(diffDays < relativeDayLimit) return RELATIVE_TIME_FORMATTER.format(-diffDays, 'day');

    return formatAbsolute(date);
};
