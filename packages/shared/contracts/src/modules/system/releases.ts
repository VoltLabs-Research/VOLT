// Picks VOLT's releases out of the repository's: it also publishes other products' releases
// (`voltsdk-*`), so GitHub's own "latest release" is not necessarily VOLT's.

export interface GithubReleaseSummary{
    tag_name: string;
    html_url: string;
    draft: boolean;
    prerelease: boolean;
}

export const VOLT_RELEASES_API = 'https://api.github.com/repos/voltlabs-research/volt/releases?per_page=30';

export const isVoltReleaseTag = (tag: string): boolean =>
    /^v\d+\.\d+\.\d+$/.test(tag);

// "v2.4.0" and "2.4.0" are the same release.
export const normalizeVersion = (version: string): string =>
    version.trim().replace(/^v/, '');

// Negative when a is older than b, 0 when equal, positive when newer. Compares major.minor.patch.
export const compareVersions = (a: string, b: string): number => {
    const parse = (value: string): number[] => normalizeVersion(value).split('.').map((part) => Number.parseInt(part, 10) || 0);
    const [left, right] = [parse(a), parse(b)];
    for(let index = 0; index < 3; index++){
        const difference = (left[index] ?? 0) - (right[index] ?? 0);
        if(difference !== 0) return difference;
    }
    return 0;
};

// The newest published VOLT release, by version rather than by publish date.
export const pickLatestVoltRelease = <T extends GithubReleaseSummary>(releases: T[]): T | null =>
    releases
        .filter((release) => !release.draft && !release.prerelease && isVoltReleaseTag(release.tag_name))
        .sort((a, b) => compareVersions(b.tag_name, a.tag_name))[0] ?? null;

// Whether `latest` is a newer release than `current`.
export const isNewerVersion = (latest: string, current: string): boolean =>
    compareVersions(latest, current) > 0;
