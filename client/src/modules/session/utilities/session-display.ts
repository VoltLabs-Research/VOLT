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

const normalizeSessionString = (value: string | null | undefined): string => {
    if (typeof value !== 'string') {
        return '';
    }

    return value.trim();
};

export const parseSessionUserAgent = (userAgent: string | null | undefined): SessionUserAgentInfo => {
    const normalizedUserAgent = normalizeSessionString(userAgent);
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

    return { browser, os };
};

export const isMobileUserAgent = (userAgent: string | null | undefined): boolean => {
    return MOBILE_USER_AGENT_PATTERN.test(normalizeSessionString(userAgent));
};

export const formatSessionRelativeTime = (dateValue: string | null | undefined): string => {
    if (!dateValue) {
        return 'Unknown activity';
    }

    const now = Date.now();
    const then = new Date(dateValue).getTime();
    if (!Number.isFinite(then)) {
        return 'Unknown activity';
    }

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

export const getSessionTokenInfo = (token: string | null | undefined): SessionTokenInfo => {
    const normalizedToken = normalizeSessionString(token);

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
