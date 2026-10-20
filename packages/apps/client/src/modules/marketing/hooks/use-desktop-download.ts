import { latestDesktopReleaseQuery } from '@/modules/marketing/hooks/queries';
import { detectCpuArch, detectDesktopOs } from '@/modules/marketing/utils/detect-desktop-os';
import { resolveDesktopDownload } from '@/modules/marketing/utils/resolve-desktop-download';

export const useDesktopDownload = () => {
    const { data } = latestDesktopReleaseQuery(undefined, {
        staleTime: 5 * 60_000
    });

    return resolveDesktopDownload(data ?? null, detectDesktopOs(), detectCpuArch());
};
