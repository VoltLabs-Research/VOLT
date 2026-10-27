import { useEffect, useState } from 'react';
import { getLatestRelease } from '@/api/github-release-service';
import { detectCpuArch, detectDesktopOs } from '@/utils/detect-desktop-os';
import { resolveDesktopDownload } from '@/utils/resolve-desktop-download';
import type { GitHubRelease } from '@/contracts/release';

export const useDesktopDownload = () => {
    const [release, setRelease] = useState<GitHubRelease | null>(null);

    useEffect(() => {
        let isCurrent = true;
        // Without the release, the link still opens the latest release page on GitHub.
        getLatestRelease()
            .then((latest) => {
                if (isCurrent) setRelease(latest);
            })
            .catch(() => undefined);
        return () => {
            isCurrent = false;
        };
    }, []);

    return resolveDesktopDownload(release, detectDesktopOs(), detectCpuArch());
};
