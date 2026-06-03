import type Session from '@modules/session/domain/entities/Session';
import type { SessionProps } from '@modules/session/domain/entities/Session';
import type { PersistedEntityOutput } from '@shared/domain/persisted/to-persisted-entity';

interface ParsedUserAgent {
    browser: string;
    os: string;
    isMobile: boolean;
}

const MOBILE_PATTERN = /Android|iPhone|iPad|iPod|Mobile/i;

const parseUserAgent = (userAgent: string): ParsedUserAgent => {
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

    return { browser, os, isMobile: MOBILE_PATTERN.test(userAgent) };
};

export interface PersistedSessionDTO extends Omit<PersistedEntityOutput<SessionProps>, 'token'> {
    token: null;
    isCurrent: boolean;
    browser: string;
    os: string;
    isMobile: boolean;
}

export const toPersistedSessionDTO = (session: Session, currentToken?: string): PersistedSessionDTO => {
    const ua = parseUserAgent(session.props.userAgent ?? '');
    return {
        _id: session._id,
        ...session.props,
        token: null,
        isCurrent: Boolean(currentToken && session.props.token === currentToken),
        browser: ua.browser,
        os: ua.os,
        isMobile: ua.isMobile
    };
};
