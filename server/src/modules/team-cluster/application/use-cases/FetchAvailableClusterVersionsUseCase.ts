import {
    AvailableClusterVersionDTO,
    FetchAvailableClusterVersionsInputDTO,
    FetchAvailableClusterVersionsOutputDTO
} from '@modules/team-cluster/application/dtos/FetchAvailableClusterVersionsDTO';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';

const GITHUB_API_RELEASES_URL = 'https://api.github.com/repos/voltlabs-research/volt-cluster-daemon/releases';
const EDGE_OPTION: AvailableClusterVersionDTO = {
    tag: 'main',
    publishedAt: null,
    isLatest: false,
    isEdge: true
};

interface GitHubRelease {
    tag_name: string;
    published_at: string;
    draft: boolean;
    prerelease: boolean;
};

/**
 * Fetches available daemon versions from GitHub Releases and appends the edge option.
 *
 * - Stable releases are sourced from the GitHub Releases API.
 * - The edge option (`main`) is always included, even if the GitHub call fails.
 * - If a GITHUB_TOKEN environment variable is present it is forwarded as a Bearer token
 *   to avoid anonymous rate-limiting.
 */
@injectable()
export default class FetchAvailableClusterVersionsUseCase
    implements IUseCase<FetchAvailableClusterVersionsInputDTO, FetchAvailableClusterVersionsOutputDTO, ApplicationError> {

    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository
    ) {}

    async execute(
        input: FetchAvailableClusterVersionsInputDTO
    ): Promise<Result<FetchAvailableClusterVersionsOutputDTO, ApplicationError>> {
        const teamCluster = await this.teamClusterRepository.findById(input.teamClusterId);
        if (!teamCluster || teamCluster.props.team !== input.teamId) {
            return Result.fail(ApplicationError.notFound(
                'TeamCluster::NotFound',
                'Team cluster not found'
            ));
        }

        const stableVersions = await this.fetchStableVersions();
        const versions = this.deduplicateByTag([...stableVersions, EDGE_OPTION]);

        return Result.ok({ versions });
    }

    private deduplicateByTag(versions: AvailableClusterVersionDTO[]): AvailableClusterVersionDTO[] {
        const seen = new Set<string>();
        return versions.filter((version) => {
            if (seen.has(version.tag)) {
                return false;
            }
            seen.add(version.tag);
            return true;
        });
    }

    private async fetchStableVersions(): Promise<AvailableClusterVersionDTO[]> {
        try {
            const headers: Record<string, string> = {
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'volt-server'
            };

            const githubToken = process.env['GITHUB_TOKEN'];
            if (githubToken) {
                headers['Authorization'] = `Bearer ${githubToken}`;
            }

            const response = await fetch(GITHUB_API_RELEASES_URL, { headers });

            if (!response.ok) {
                logger.warn({
                    action: 'team-cluster.available-versions.github-api-error',
                    status: response.status
                }, 'GitHub Releases API returned non-OK status; returning only edge option');
                return [];
            }

            const releases = await response.json() as GitHubRelease[];

            if (!Array.isArray(releases)) {
                return [];
            }

            const publishedReleases = releases.filter(
                (release) => !release.draft && !release.prerelease
            );

            return publishedReleases.map((release, index) => ({
                tag: release.tag_name,
                publishedAt: release.published_at ?? null,
                isLatest: index === 0,
                isEdge: false
            }));
        } catch (error: unknown) {
            logger.warn({
                action: 'team-cluster.available-versions.fetch-failed',
                err: error
            }, 'Failed to fetch GitHub releases; returning only edge option');
            return [];
        }
    }
};
