export interface ParsedUserAgent{
    browser: string;
    os: string;
    isMobile: boolean;
}

const MOBILE_PATTERN = /Android|iPhone|iPad|iPod|Mobile/i;

const resolveBrowser = (userAgent: string): string => {
    if(userAgent.includes('Firefox/')) return 'Firefox';
    if(userAgent.includes('Edg/')) return 'Edge';
    if(userAgent.includes('OPR/') || userAgent.includes('Opera/')) return 'Opera';
    if(userAgent.includes('Chrome/') && userAgent.includes('Safari/')) return 'Chrome';
    if(userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) return 'Safari';
    return 'Unknown Browser';
};

const resolveOperatingSystem = (userAgent: string): string => {
    if(userAgent.includes('Windows')) return 'Windows';
    if(userAgent.includes('Mac OS X') || userAgent.includes('Macintosh')) return 'macOS';
    if(userAgent.includes('Android')) return 'Android';
    if(userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
    if(userAgent.includes('Linux')) return 'Linux';
    if(userAgent.includes('CrOS')) return 'ChromeOS';
    return 'Unknown OS';
};

export const parseUserAgent = (userAgent: string): ParsedUserAgent => {
    const normalized = userAgent.trim();

    return {
        browser: resolveBrowser(normalized),
        os: resolveOperatingSystem(normalized),
        isMobile: MOBILE_PATTERN.test(normalized)
    };
};
