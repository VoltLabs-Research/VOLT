import type { CpuArch, DesktopOs } from '@/modules/marketing/contracts/release';

interface NavigatorUAData {
    platform?: string;
};

const readUserAgentData = (): NavigatorUAData | undefined => {
    return (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;
};

export const detectDesktopOs = (): DesktopOs => {
    const platform = `${readUserAgentData()?.platform ?? ''} ${navigator.userAgent}`.toLowerCase();

    if (platform.includes('win')) {
        return 'windows';
    }

    if (platform.includes('mac') || platform.includes('iphone') || platform.includes('ipad')) {
        return 'macos';
    }

    if (platform.includes('linux') || platform.includes('cros') || platform.includes('android')) {
        return 'linux';
    }

    return 'unknown';
};

export const detectCpuArch = (): CpuArch => {
    const platform = `${readUserAgentData()?.platform ?? ''} ${navigator.userAgent} ${navigator.platform}`.toLowerCase();

    if (platform.includes('arm') || platform.includes('aarch64')) {
        return 'arm';
    }

    if (platform.includes('x86_64') || platform.includes('win64') || platform.includes('wow64') || platform.includes('amd64') || platform.includes('x64')) {
        return 'x64';
    }

    return 'unknown';
};
