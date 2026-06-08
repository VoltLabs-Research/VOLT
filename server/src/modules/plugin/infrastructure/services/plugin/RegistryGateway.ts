import { getRegistryUrl } from '@core/config/registry';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

export interface RegistryPackageSummary {
    fullName: string;
    name: string;
    username: string;
    kind: string;
    description?: string;
    keywords?: string[];
    latest?: string;
    downloads?: { total: number; last30d: number };
    updatedAt?: string;
}

export interface RegistrySearchResult {
    items: RegistryPackageSummary[];
    page: number;
    pageSize: number;
    total: number;
}

export interface ResolvedRegistryTarball {
    downloadUrl: string;
    sha256: string;
    fileName: string;
    version: string;
}

interface ParsedPackageName {
    username: string;
    name: string;
}

const parsePackageName = (fullName: string): ParsedPackageName => {
    const match = /^@([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9._-]*)$/.exec(fullName.trim().toLowerCase());
    if (!match) {
        throw ApplicationError.badRequest(
            'Registry::InvalidPackageName',
            'Registry package name must be @username/name'
        );
    }

    return { username: match[1], name: match[2] };
};

@Singleton(PLUGIN_TOKENS.RegistryGateway)
export default class RegistryGateway {
    private readonly baseUrl = getRegistryUrl();

    async search(q: string, page: number, pageSize: number): Promise<RegistrySearchResult> {
        const query = new URLSearchParams({
            q,
            kind: 'workflow',
            page: String(page),
            pageSize: String(pageSize)
        });

        const response = await this.fetch(`/-/search?${query.toString()}`);
        if (!response.ok) {
            throw this.unavailable(`search failed with status ${response.status}`);
        }

        return (await response.json()) as RegistrySearchResult;
    }

    async resolveTarball(fullName: string, version: string | undefined, platform: string): Promise<ResolvedRegistryTarball> {
        const { username, name } = parsePackageName(fullName);
        const resolvedVersion = version ?? (await this.resolveLatestVersion(username, name));
        const path = `/packages/${encodeURIComponent(username)}/${encodeURIComponent(name)}/${encodeURIComponent(resolvedVersion)}/-/${encodeURIComponent(platform)}.tgz`;

        const response = await this.fetch(path, { redirect: 'manual' });
        const location = response.headers.get('location');
        if (response.status !== 307 && response.status !== 302) {
            throw this.unavailable(`tarball resolution failed with status ${response.status}`);
        }
        if (!location) {
            throw this.unavailable('registry redirect is missing the Location header');
        }

        const sha256 = response.headers.get('x-volt-sha256');
        if (!sha256) {
            throw this.unavailable('registry redirect is missing the X-Volt-Sha256 header');
        }

        return {
            downloadUrl: location,
            sha256,
            fileName: `${name}-${resolvedVersion}-${platform}.tgz`,
            version: resolvedVersion
        };
    }

    private async resolveLatestVersion(username: string, name: string): Promise<string> {
        const response = await this.fetch(`/packages/${encodeURIComponent(username)}/${encodeURIComponent(name)}`);
        if (response.status === 404) {
            throw ApplicationError.notFound('Registry::PackageNotFound', `Package @${username}/${name} not found`);
        }
        if (!response.ok) {
            throw this.unavailable(`packument lookup failed with status ${response.status}`);
        }

        const packument = (await response.json()) as { distTags?: { latest?: string } };
        const latest = packument.distTags?.latest;
        if (!latest) {
            throw this.unavailable(`package @${username}/${name} has no latest version`);
        }

        return latest;
    }

    private fetch(path: string, init?: RequestInit): Promise<Response> {
        return fetch(`${this.baseUrl}${path}`, init).catch((cause) => {
            throw this.unavailable('registry request failed', cause);
        });
    }

    private unavailable(message: string, cause?: unknown): ApplicationError {
        return new ApplicationError('Registry::Unavailable', `Plugin registry unavailable: ${message}`, {
            statusCode: 502,
            cause
        });
    }
}
