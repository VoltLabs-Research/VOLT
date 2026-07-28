import { SessionActivityType } from '@volt/contracts/modules/session/domain';
import { formatCompactRelativeTime } from '@/shared/utils/format-relative-time';
import { Globe, KeyRound, LogIn, LogOut } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const SESSION_RELATIVE_DAY_LIMIT = 30;

interface SessionUserAgentInfo {
    browser: string;
    os: string;
};

export const parseSessionUserAgent = (userAgent: string): SessionUserAgentInfo => {
    const normalizedUserAgent = userAgent.trim();
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';

    if (normalizedUserAgent.includes('Firefox/')) browser = 'Firefox';
    else if (normalizedUserAgent.includes('Edg/')) browser = 'Edge';
    else if (normalizedUserAgent.includes('OPR/') || normalizedUserAgent.includes('Opera/')) browser = 'Opera';
    else if (normalizedUserAgent.includes('Chrome/') && normalizedUserAgent.includes('Safari/')) browser = 'Chrome';
    else if (normalizedUserAgent.includes('Safari/') && !normalizedUserAgent.includes('Chrome/')) browser = 'Safari';

    if (normalizedUserAgent.includes('Windows')) os = 'Windows';
    else if (normalizedUserAgent.includes('Mac OS X') || normalizedUserAgent.includes('Macintosh')) os = 'macOS';
    else if (normalizedUserAgent.includes('Android')) os = 'Android';
    else if (normalizedUserAgent.includes('iPhone') || normalizedUserAgent.includes('iPad')) os = 'iOS';
    else if (normalizedUserAgent.includes('Linux')) os = 'Linux';
    else if (normalizedUserAgent.includes('CrOS')) os = 'ChromeOS';

    return {
        browser,
        os
    };
};

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
