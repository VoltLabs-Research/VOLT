import type { CpuArch, DesktopOs, GitHubRelease, GitHubReleaseAsset, ResolvedDesktopDownload } from '@/modules/marketing/contracts/release';
import { GITHUB_RELEASES_LATEST } from '@/modules/marketing/contracts/release';

const INSTALLER_EXTENSIONS: Record<Exclude<DesktopOs, 'unknown'>, string[]> = {
    windows: ['.exe'],
    macos: ['.dmg'],
    linux: ['.appimage', '.deb']
};

const rankMacAsset = (name: string, arch: CpuArch): number => {
    const isArm = name.includes('arm64') || name.includes('aarch64');

    if (arch === 'arm') {
        return isArm ? 0 : 1;
    }

    if (arch === 'x64') {
        return isArm ? 1 : 0;
    }

    return isArm ? 0 : 1;
};

const pickAsset = (assets: GitHubReleaseAsset[], os: Exclude<DesktopOs, 'unknown'>, arch: CpuArch): GitHubReleaseAsset | null => {
    const matches = INSTALLER_EXTENSIONS[os].flatMap((extension) => (
        assets.filter((asset) => asset.name.toLowerCase().endsWith(extension))
    ));

    if (matches.length === 0) {
        return null;
    }

    if (os !== 'macos') {
        return matches[0] ?? null;
    }

    return [...matches].sort((left, right) => (
        rankMacAsset(left.name.toLowerCase(), arch) - rankMacAsset(right.name.toLowerCase(), arch)
    ))[0] ?? null;
};

export const resolveDesktopDownload = (
    release: GitHubRelease | null,
    os: DesktopOs,
    arch: CpuArch
): ResolvedDesktopDownload => {
    const version = release?.tag_name.replace(/^v/i, '') ?? null;

    if (!release || os === 'unknown') {
        return {
            os,
            href: release?.html_url ?? GITHUB_RELEASES_LATEST,
            assetName: null,
            version
        };
    }

    const asset = pickAsset(release.assets, os, arch);

    return {
        os,
        href: asset?.browser_download_url ?? release.html_url,
        assetName: asset?.name ?? null,
        version
    };
};
