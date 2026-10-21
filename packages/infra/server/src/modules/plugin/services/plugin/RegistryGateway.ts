import { ErrorCodes } from '@core/constants/error-codes';
import { getRegistryUrl } from '@core/config/registry';
import ApplicationError from '@shared/errors/ApplicationError';
import type { SearchRegistryResponse } from '@volt/contracts/modules/plugin/registry';

export type RegistrySearchResult = SearchRegistryResponse;

interface ResolvedRegistryTarball {
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
            ErrorCodes.REGISTRY_INVALID_PACKAGE_NAME,
            'Registry package name must be @username/name'
        );
    }

    return {
        username: match[1],
        name: match[2]
    };
};

export interface SearchRegistryPluginsInput {
    teamId: string;
    q?: string;
    page?: number;
    limit?: number;
}

class RegistryGateway {
    private readonly baseUrl = getRegistryUrl();

    async search(q = '', page = 1, pageSize = 20): Promise<RegistrySearchResult> {
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

    // The daemon downloads the tarball from the registry: a native one is redirected to the storage
    // that serves it, and one running in a browser is served it by the registry, which pages may
    // read. What the tarball is comes as JSON, which code reads wherever it runs (a browser hides a
    // redirect's status and headers).
    async resolveTarball(fullName: string, version: string | undefined, platform: string): Promise<ResolvedRegistryTarball> {
        const { username, name } = parsePackageName(fullName);
        const resolvedVersion = version ?? (await this.resolveLatestVersion(username, name));
        const path = `/packages/${encodeURIComponent(username)}/${encodeURIComponent(name)}/${encodeURIComponent(resolvedVersion)}/-/${encodeURIComponent(platform)}.tgz`;

        const response = await this.fetch(path, { headers: { accept: 'application/json' } });
        if (!response.ok) {
            throw this.unavailable(`tarball resolution failed with status ${response.status}`);
        }
        const { sha256 } = (await response.json()) as { sha256?: string };
        if (!sha256) {
            throw this.unavailable('registry tarball resolution is missing its sha256');
        }

        return {
            downloadUrl: `${this.baseUrl}${path}`,
            sha256,
            fileName: `${name}-${resolvedVersion}-${platform}.tgz`,
            version: resolvedVersion
        };
    }

    private async resolveLatestVersion(username: string, name: string): Promise<string> {
        const response = await this.fetch(`/packages/${encodeURIComponent(username)}/${encodeURIComponent(name)}`);
        if (response.status === 404) {
            throw ApplicationError.notFound(ErrorCodes.REGISTRY_PACKAGE_NOT_FOUND, `Package @${username}/${name} not found`);
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
        return new ApplicationError(ErrorCodes.REGISTRY_UNAVAILABLE, `Plugin registry unavailable: ${message}`, {
            statusCode: 502,
            cause
        });
    }
}

export default new RegistryGateway();
