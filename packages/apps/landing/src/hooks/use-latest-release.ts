import { useEffect, useState } from 'react';
import { getLatestRelease } from '@/api/github-release-service';
import type { GitHubRelease } from '@/contracts/release';

// Null until GitHub answers, and for good when it does not: callers link to the releases page then.
export const useLatestRelease = (): GitHubRelease | null => {
    const [release, setRelease] = useState<GitHubRelease | null>(null);

    useEffect(() => {
        let isCurrent = true;
        getLatestRelease()
            .then((latest) => {
                if (isCurrent) setRelease(latest);
            })
            .catch(() => undefined);
        return () => {
            isCurrent = false;
        };
    }, []);

    return release;
};
