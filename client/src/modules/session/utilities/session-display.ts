import { SessionActivityType } from '../api/entities/session';
import { Globe, KeyRound, LogIn } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SessionUserAgentInfo {
    browser: string;
    os: string;
};

interface SessionTokenInfo {
    shortValue: string;
};

const MOBILE_USER_AGENT_PATTERN = /Android|iPhone|iPad|iPod|Mobile/i;

export const parseSessionUserAgent = (userAgent: string): SessionUserAgentInfo => {
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';

    if (userAgent.includes('Firefox/')) browser = 'Firefox';
    else if (userAgent.includes('Edg/')) browser = 'Edge';
    else if (userAgent.includes('OPR/') || userAgent.includes('Opera/')) browser = 'Opera';
    else if (userAgent.includes('Chrome/') && userAgent.includes('Safari/')) browser = 'Chrome';
    else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) browser = 'Safari';

    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac OS X') || userAgent.includes('Macintosh')) os = 'macOS';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('CrOS')) os = 'ChromeOS';

    return { browser, os };
};

export const isMobileUserAgent = MOBILE_USER_AGENT_PATTERN.test.bind(MOBILE_USER_AGENT_PATTERN);

export const formatSessionRelativeTime = (dateValue: string): string => {
    const now = Date.now();
    const then = new Date(dateValue).getTime();
    const diffMs = now - then;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 30) return `${diffDay}d ago`;
    return new Date(dateValue).toLocaleDateString();
};

export const getSessionTokenInfo = (token: string): SessionTokenInfo => {
    const normalizedToken = token.trim();

    if (normalizedToken.length <= 8) {
        return { shortValue: normalizedToken || 'Unavailable' };
    }

    return {
        shortValue: `${normalizedToken.slice(0, 4)}…${normalizedToken.slice(-4)}`
    };
};

export const SESSION_ACTION_LABELS: Record<SessionActivityType, string> = {
    [SessionActivityType.Login]: 'Login',
    [SessionActivityType.Logout]: 'Logout',
    [SessionActivityType.FailedLogin]: 'Failed',
    [SessionActivityType.OAuthLogin]: 'OAuth',
    [SessionActivityType.PasswordUpdate]: 'Password Update'
};

export const SESSION_ACTION_VARIANTS: Record<SessionActivityType, 'success' | 'danger' | 'warning' | 'brand' | 'neutral'> = {
    [SessionActivityType.Login]: 'success',
    [SessionActivityType.Logout]: 'neutral',
    [SessionActivityType.FailedLogin]: 'danger',
    [SessionActivityType.OAuthLogin]: 'brand',
    [SessionActivityType.PasswordUpdate]: 'warning'
};

export const getSessionActivityIcon = (action: SessionActivityType): LucideIcon => {
    if (action === SessionActivityType.OAuthLogin) return Globe;
    if (action === SessionActivityType.PasswordUpdate) return KeyRound;
    return LogIn;
};
