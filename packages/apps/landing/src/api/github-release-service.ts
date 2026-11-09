import type { GitHubRelease } from '@/contracts/release';
import { GITHUB_RELEASES_API } from '@/contracts/release';

const fetchLatestRelease = async (): Promise<GitHubRelease> => {
    const response = await fetch(GITHUB_RELEASES_API, {
        headers: {
            Accept: 'application/vnd.github+json'
        }
    });

    if (!response.ok) {
        throw new Error('Failed to load the latest VOLT release');
    }

    return response.json() as Promise<GitHubRelease>;
};

let latestRelease: Promise<GitHubRelease> | null = null;

// The hero's download menu and the desktop card read the same release, so one request serves both.
// A failed request is dropped, and the next read asks again.
export const getLatestRelease = (): Promise<GitHubRelease> => {
    latestRelease ??= fetchLatestRelease().catch((error: unknown) => {
        latestRelease = null;
        throw error;
    });

    return latestRelease;
};
