import { SessionActivityType } from '@volt/contracts/modules/session/domain';
import { formatCompactRelativeTime } from '@/shared/utils/format-relative-time';
import { Globe, KeyRound, LogIn, LogOut } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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

export const getSessionActivityIcon = (action: SessionActivityType): LucideIcon => {
    if (action === SessionActivityType.OAuthLogin) return Globe;
    if (action === SessionActivityType.PasswordUpdate) return KeyRound;
    if (action === SessionActivityType.Logout) return LogOut;
    return LogIn;
};
