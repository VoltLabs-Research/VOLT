export const GITHUB_RELEASES_LATEST = 'https://github.com/VoltLabs-Research/VOLT/releases/latest';
export const GITHUB_RELEASES_API = 'https://api.github.com/repos/VoltLabs-Research/VOLT/releases/latest';

export type DesktopOs = 'windows' | 'macos' | 'linux' | 'unknown';
export type CpuArch = 'arm' | 'x64' | 'unknown';

export interface GitHubReleaseAsset {
    name: string;
    browser_download_url: string;
    size: number;
};

export interface GitHubRelease {
    tag_name: string;
    html_url: string;
    assets: GitHubReleaseAsset[];
};

export interface ResolvedDesktopDownload {
    os: DesktopOs;
    href: string;
    assetName: string | null;
    version: string | null;
};
