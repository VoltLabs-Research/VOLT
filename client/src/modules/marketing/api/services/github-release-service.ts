import type { GitHubRelease } from '@/modules/marketing/contracts/release';
import { GITHUB_RELEASES_API } from '@/modules/marketing/contracts/release';

const getLatestRelease = async (): Promise<GitHubRelease> => {
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

export default {
    getLatestRelease
};
