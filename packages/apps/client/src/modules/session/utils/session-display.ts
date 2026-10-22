import { SessionActivityType } from '@volt/contracts/modules/session/domain';
import { formatCompactRelativeTime } from '@/shared/utils/format-relative-time';

const SESSION_RELATIVE_DAY_LIMIT = 30;


export const formatSessionRelativeTime = (dateValue: string | null | undefined): string => {
    return formatCompactRelativeTime(dateValue, {
        fallback: 'Unknown activity',
        relativeDayLimit: SESSION_RELATIVE_DAY_LIMIT,
        formatAbsolute: (date) => date.toLocaleDateString()
    });
};

export const SESSION_ACTION_LABELS: Record<SessionActivityType, string> = {
    [SessionActivityType.Login]: 'Signed in',
    [SessionActivityType.Logout]: 'Signed out',
    [SessionActivityType.FailedLogin]: 'Failed sign-in',
    [SessionActivityType.OAuthLogin]: 'Signed in with OAuth',
    [SessionActivityType.PasswordUpdate]: 'Password changed'
};
