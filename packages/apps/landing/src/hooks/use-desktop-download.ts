import { useLatestRelease } from '@/hooks/use-latest-release';
import { detectCpuArch, detectDesktopOs } from '@/utils/detect-desktop-os';
import { resolveDesktopDownload } from '@/utils/resolve-desktop-download';

// Without the release, the link still opens the latest release page on GitHub.
export const useDesktopDownload = () => {
    const release = useLatestRelease();

    return resolveDesktopDownload(release, detectDesktopOs(), detectCpuArch());
};
