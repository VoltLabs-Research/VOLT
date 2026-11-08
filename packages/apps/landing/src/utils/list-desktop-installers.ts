import type { DesktopInstaller, DesktopOs, GitHubRelease } from '@/contracts/release';
import { GITHUB_RELEASES_LATEST } from '@/contracts/release';
import { INSTALLER_EXTENSIONS } from '@/utils/resolve-desktop-download';

type InstallerOs = Exclude<DesktopOs, 'unknown'>;

const INSTALLER_ORDER: InstallerOs[] = ['macos', 'windows', 'linux'];

const OS_NAMES: Record<InstallerOs, string> = {
    macos: 'macOS',
    windows: 'Windows',
    linux: 'Linux'
};

// electron-builder marks Apple Silicon builds with arm64 and leaves Intel builds unmarked.
const describeInstaller = (os: InstallerOs, assetName: string): string | null => {
    const name = assetName.toLowerCase();

    if (os === 'macos') {
        if (name.includes('universal')) return null;
        return name.includes('arm64') || name.includes('aarch64') ? 'Apple Silicon' : 'Intel';
    }

    if (os === 'linux') {
        return name.endsWith('.deb') ? '.deb' : 'AppImage';
    }

    return null;
};

/*
 * The installers of the latest release by OS, in the order the menu lists them. An OS the release has
 * no installer for, or every OS while the release is unknown, links to the release page instead.
 */
export const listDesktopInstallers = (release: GitHubRelease | null): DesktopInstaller[] => (
    INSTALLER_ORDER.flatMap((os): DesktopInstaller[] => {
        const fallback: DesktopInstaller = {
            os,
            name: OS_NAMES[os],
            detail: null,
            href: release?.html_url ?? GITHUB_RELEASES_LATEST,
            size: null
        };

        if (!release) return [fallback];

        const assets = INSTALLER_EXTENSIONS[os].flatMap((extension) => (
            release.assets.filter((asset) => asset.name.toLowerCase().endsWith(extension))
        ));
        if (assets.length === 0) return [fallback];

        return assets
            .map((asset) => ({
                os,
                name: OS_NAMES[os],
                detail: describeInstaller(os, asset.name),
                href: asset.browser_download_url,
                size: asset.size
            }))
            .sort((left, right) => Number(left.detail === 'Intel') - Number(right.detail === 'Intel'));
    })
);

const SIZE_FORMAT = new Intl.NumberFormat('en-US', { style: 'unit', unit: 'megabyte', maximumFractionDigits: 0 });

export const formatInstallerSize = (bytes: number): string => SIZE_FORMAT.format(bytes / 1_000_000);
