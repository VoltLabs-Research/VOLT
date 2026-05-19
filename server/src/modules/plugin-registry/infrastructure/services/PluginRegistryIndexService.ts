import { createHash } from 'node:crypto';
import logger from '@shared/infrastructure/logger';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';

const DEFAULT_GITHUB_OWNER = 'VoltLabs-Research';
const DEFAULT_CACHE_TTL_MS = 300000;
const DEFAULT_REPOSITORIES = [
    'AcklandJonesStructureIdentification',
    'AtomicStrain',
    'BasalPlaneVector',
    'CentroSymmetryParameter',
    'ClusterAnalysis',
    'CommonNeighborAnalysis',
    'ComputeProperty',
    'ConstructSurfaceMesh',
    'CoordinationAnalysis',
    'DisplacementsAnalysis',
    'ElasticStrain',
    'GrainSegmentation',
    'LineReconstructionDXA',
    'LocalComposition',
    'OpenDXA',
    'PolyhedralTemplateMatching',
    'SteinhardtOrderParameters',
    'StructureIdentification',
    'VoronoiAnalysis',
    'WignerSeitzDefectAnalysis'
] as const;

interface GitHubReleaseAsset {
    name: string;
    browser_download_url: string;
    digest?: string | null;
}

interface GitHubRelease {
    tag_name: string;
    draft: boolean;
    prerelease: boolean;
    published_at?: string | null;
    assets?: GitHubReleaseAsset[];
}

interface PluginRegistryPlatformEntry {
    url: string;
    sha256?: string;
}

interface PluginRegistryVersionEntry {
    [platform: string]: PluginRegistryPlatformEntry;
}

interface PluginRegistryPluginEntry {
    latest: string;
    versions: Record<string, PluginRegistryVersionEntry>;
}

export interface PluginRegistryIndex {
    plugins: Record<string, PluginRegistryPluginEntry>;
}

export interface PluginRegistrySnapshot {
    body: string;
    etag: string;
    generatedAt: string;
    index: PluginRegistryIndex;
    maxAgeSeconds: number;
}

interface ParsedBundleAsset {
    key: string;
    platform: string;
    version: string;
}

interface ResolvedReleaseEntry {
    bundles: PluginRegistryVersionEntry;
    key: string;
    publishedAt: number;
    version: string;
}

interface ManualPluginEntry {
    key: string;
    repository: string;
    version: string;
    platforms: string[];
}

const BUNDLE_ASSET_REGEX = /^(.+)-(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)-(linux|darwin|windows)-([0-9A-Za-z_]+)\.tar\.zst$/;
const DEFAULT_MANUAL_PLUGIN_ENTRIES: ManualPluginEntry[] = [
    {
        key: 'centrosymmetry-parameter',
        repository: 'CentroSymmetryParameter',
        version: '1.0.0',
        platforms: [
            'linux-x86_64',
            'darwin-arm64',
            'windows-x86_64'
        ]
    }
];

const parseRepositories = (rawValue: string | undefined): string[] => {
    if (!rawValue?.trim()) {
        return [...DEFAULT_REPOSITORIES];
    }

    return Array.from(new Set(
        rawValue
            .split(/[\s,]+/)
            .map((value) => value.trim())
            .filter(Boolean)
    ));
};

const normalizeDigest = (value: string | null | undefined): string => {
    if (!value) {
        return '';
    }

    const normalized = value.trim().toLowerCase();
    if (normalized.startsWith('sha256:')) {
        return normalized.slice('sha256:'.length);
    }

    return /^[a-f0-9]{64}$/.test(normalized) ? normalized : '';
};

const parseBundleAssetName = (name: string): ParsedBundleAsset | null => {
    const match = name.match(BUNDLE_ASSET_REGEX);
    if (!match) {
        return null;
    }

    return {
        key: match[1],
        version: match[2],
        platform: `${match[3]}-${match[4]}`
    };
};

const sortPlugins = (plugins: Record<string, PluginRegistryPluginEntry>): Record<string, PluginRegistryPluginEntry> => {
    return Object.fromEntries(
        Object.entries(plugins).sort(([left], [right]) => left.localeCompare(right))
    );
};

const sortPlatforms = (platforms: PluginRegistryVersionEntry): PluginRegistryVersionEntry => {
    return Object.fromEntries(
        Object.entries(platforms).sort(([left], [right]) => left.localeCompare(right))
    );
};

const createManualPluginEntries = (
    githubOwner: string,
    entries: ManualPluginEntry[]
): Record<string, PluginRegistryPluginEntry> => {
    return Object.fromEntries(entries.map((entry) => {
        const platforms: PluginRegistryVersionEntry = Object.fromEntries(entry.platforms.map((platform) => [
            platform,
            {
                url: `https://github.com/${githubOwner}/${entry.repository}/releases/download/v${entry.version}/${entry.key}-${entry.version}-${platform}.tar.zst`
            }
        ]));

        return [
            entry.key,
            {
                latest: entry.version,
                versions: {
                    [entry.version]: sortPlatforms(platforms)
                }
            }
        ];
    }));
};

export class PluginRegistryIndexService {
    private readonly cacheTtlMs = readPositiveIntegerEnv('PLUGIN_REGISTRY_CACHE_TTL_MS', DEFAULT_CACHE_TTL_MS);
    private readonly githubOwner = process.env.PLUGIN_REGISTRY_GITHUB_OWNER?.trim() || DEFAULT_GITHUB_OWNER;
    private readonly githubToken = process.env.PLUGIN_REGISTRY_GITHUB_TOKEN?.trim() || '';
    private readonly repositories = parseRepositories(process.env.PLUGIN_REGISTRY_GITHUB_REPOSITORIES);
    private cachedSnapshot: PluginRegistrySnapshot | null = null;
    private cacheExpiresAt = 0;
    private inflightSnapshot: Promise<PluginRegistrySnapshot> | null = null;

    async getSnapshot(): Promise<PluginRegistrySnapshot> {
        const now = Date.now();
        if (this.cachedSnapshot && now < this.cacheExpiresAt) {
            return this.cachedSnapshot;
        }

        if (this.inflightSnapshot) {
            return this.inflightSnapshot;
        }

        this.inflightSnapshot = this.buildSnapshot()
            .then((snapshot) => {
                this.cachedSnapshot = snapshot;
                this.cacheExpiresAt = Date.now() + this.cacheTtlMs;
                return snapshot;
            })
            .catch((error: unknown) => {
                if (this.cachedSnapshot) {
                    logger.warn(`@plugin-registry: refresh failed, serving stale snapshot error=${error instanceof Error ? error.message : String(error)}`);
                    return this.cachedSnapshot;
                }

                throw error;
            })
            .finally(() => {
                this.inflightSnapshot = null;
            });

        return this.inflightSnapshot;
    }

    private async buildSnapshot(): Promise<PluginRegistrySnapshot> {
        const startedAt = Date.now();
        const results = await Promise.allSettled(
            this.repositories.map((repository) => this.fetchPluginEntry(repository))
        );

        const plugins: Record<string, PluginRegistryPluginEntry> = createManualPluginEntries(
            this.githubOwner,
            DEFAULT_MANUAL_PLUGIN_ENTRIES
        );
        let resolvedPluginCount = 0;

        for (let index = 0; index < results.length; index += 1) {
            const repository = this.repositories[index];
            const result = results[index];

            if (result.status === 'fulfilled') {
                plugins[result.value.key] = result.value.entry;
                resolvedPluginCount += 1;
                continue;
            }

            logger.warn(`@plugin-registry: repository skipped repo=${repository} error=${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
        }

        const index = {
            plugins: sortPlugins(plugins)
        };
        const body = JSON.stringify(index, null, 2);
        const etag = `"${createHash('sha256').update(body).digest('hex')}"`;

        if (resolvedPluginCount === 0) {
            logger.warn(`@plugin-registry: snapshot-built empty repos=${this.repositories.length} durationMs=${Date.now() - startedAt}`);
        }

        logger.info(`@plugin-registry: snapshot-built plugins=${resolvedPluginCount} repos=${this.repositories.length} durationMs=${Date.now() - startedAt}`);

        return {
            body,
            etag,
            generatedAt: new Date().toISOString(),
            index,
            maxAgeSeconds: Math.max(1, Math.floor(this.cacheTtlMs / 1000))
        };
    }

    private async fetchPluginEntry(repository: string): Promise<{ entry: PluginRegistryPluginEntry; key: string }> {
        const releases = await this.fetchJson<GitHubRelease[]>(
            `https://api.github.com/repos/${this.githubOwner}/${repository}/releases?per_page=100`,
            `releases repo=${repository}`
        );

        const releaseEntries = await Promise.all(
            releases
                .filter((release) => !release.draft && !release.prerelease)
                .map((release) => this.resolveReleaseEntry(repository, release))
        );

        const availableEntries = releaseEntries
            .filter((entry): entry is ResolvedReleaseEntry => entry !== null)
            .sort((left, right) => right.publishedAt - left.publishedAt);

        if (availableEntries.length === 0) {
            throw new Error(`No published bundles found for ${repository}.`);
        }

        const key = availableEntries[0].key;
        const versions: Record<string, PluginRegistryVersionEntry> = {};

        for (const entry of availableEntries) {
            if (entry.key !== key) {
                logger.warn(`@plugin-registry: inconsistent plugin key repo=${repository} expected=${key} actual=${entry.key} version=${entry.version}`);
                continue;
            }

            if (versions[entry.version]) {
                continue;
            }

            versions[entry.version] = entry.bundles;
        }

        if (Object.keys(versions).length === 0) {
            throw new Error(`No consistent bundle versions found for ${repository}.`);
        }

        return {
            key,
            entry: {
                latest: availableEntries[0].version,
                versions
            }
        };
    }

    private async resolveReleaseEntry(repository: string, release: GitHubRelease): Promise<ResolvedReleaseEntry | null> {
        const assets = Array.isArray(release.assets) ? release.assets : [];
        if (assets.length === 0) {
            return null;
        }

        const checksumAssets = new Map<string, GitHubReleaseAsset>();
        const bundleAssets: GitHubReleaseAsset[] = [];

        for (const asset of assets) {
            if (asset.name.endsWith('.tar.zst.sha256')) {
                checksumAssets.set(asset.name.slice(0, -'.sha256'.length), asset);
                continue;
            }

            if (asset.name.endsWith('.tar.zst')) {
                bundleAssets.push(asset);
            }
        }

        if (bundleAssets.length === 0) {
            return null;
        }

        const resolvedBundles = await Promise.all(bundleAssets.map(async (asset) => {
            const parsed = parseBundleAssetName(asset.name);
            if (!parsed) {
                return null;
            }

            const checksumAsset = checksumAssets.get(asset.name);
            const sha256 = normalizeDigest(asset.digest) || await this.fetchChecksum(checksumAsset);

            return {
                ...parsed,
                sha256,
                url: asset.browser_download_url
            };
        }));

        const validBundles = resolvedBundles.filter((bundle): bundle is ParsedBundleAsset & { sha256: string; url: string } => bundle !== null);
        if (validBundles.length === 0) {
            return null;
        }

        const key = validBundles[0].key;
        const version = validBundles[0].version;
        const bundles: PluginRegistryVersionEntry = {};

        for (const bundle of validBundles) {
            if (bundle.key !== key || bundle.version !== version) {
                logger.warn(`@plugin-registry: inconsistent bundle asset repo=${repository} release=${release.tag_name} asset=${bundle.url}`);
                continue;
            }

            bundles[bundle.platform] = bundle.sha256
                ? { url: bundle.url, sha256: bundle.sha256 }
                : { url: bundle.url };
        }

        if (Object.keys(bundles).length === 0) {
            return null;
        }

        return {
            bundles: sortPlatforms(bundles),
            key,
            publishedAt: Date.parse(release.published_at || '') || 0,
            version
        };
    }

    private async fetchChecksum(asset: GitHubReleaseAsset | undefined): Promise<string> {
        if (!asset) {
            return '';
        }

        try {
            const response = await fetch(asset.browser_download_url, {
                headers: {
                    'User-Agent': 'volt-plugin-registry'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const content = await response.text();
            const match = content.match(/\b([a-fA-F0-9]{64})\b/);
            return match?.[1]?.toLowerCase() || '';
        } catch (error: unknown) {
            logger.warn(`@plugin-registry: checksum fetch failed asset=${asset.name} error=${error instanceof Error ? error.message : String(error)}`);
            return '';
        }
    }

    private async fetchJson<T>(url: string, label: string): Promise<T> {
        const headers = new Headers({
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'volt-plugin-registry',
            'X-GitHub-Api-Version': '2022-11-28'
        });

        if (this.githubToken) {
            headers.set('Authorization', `Bearer ${this.githubToken}`);
        }

        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`${label} failed with HTTP ${response.status}`);
        }

        return await response.json() as T;
    }
}

export default PluginRegistryIndexService;
