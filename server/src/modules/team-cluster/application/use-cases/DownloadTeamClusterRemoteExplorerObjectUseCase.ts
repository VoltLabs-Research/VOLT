import {
    DownloadTeamClusterRemoteExplorerObjectInputDTO,
    DownloadTeamClusterRemoteExplorerObjectOutputDTO
} from '@modules/team-cluster/application/dtos/DownloadTeamClusterRemoteExplorerObjectDTO';
import { TeamClusterRemoteAccessTargetDTO } from '@modules/team-cluster/application/dtos/TeamClusterRemoteAccessDTO';
import { preflightRemoteExplorerAccess } from '@modules/team-cluster/application/utilities/remote-explorer-access';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import RemoteExplorerDaemonGateway from '@modules/team-cluster/infrastructure/services/RemoteExplorerDaemonGateway';
import TeamClusterRemoteAccessSessionService from '@modules/team-cluster/infrastructure/services/TeamClusterRemoteAccessSessionService';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import type { IUseCase } from '@shared/application/IUseCase';

/**
 * Derives a human-readable filename from the object path when the daemon
 * does not provide a Content-Disposition header.
 *
 * @param target - The remote access target (minio, mongo-documents, redis-data).
 * @param path - The object path as sent in the request.
 */
const deriveFallbackFilename = (target: TeamClusterRemoteAccessTargetDTO, path: string): string => {
    const lastSegment = path.split('/').filter(Boolean).pop() ?? 'download';

    if (target === TeamClusterRemoteAccessTargetDTO.MongoDocuments) {
        return `${lastSegment}.json`;
    }

    if (target === TeamClusterRemoteAccessTargetDTO.RedisData) {
        return `${lastSegment}.json`;
    }

    return lastSegment;
};

const readFilenameFromContentDisposition = (value: string | undefined): string | undefined => {
    if (!value) {
        return undefined;
    }

    const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
        return decodeURIComponent(utf8Match[1]);
    }

    const quotedMatch = value.match(/filename="([^"]+)"/i);
    if (quotedMatch?.[1]) {
        return quotedMatch[1];
    }

    const bareMatch = value.match(/filename=([^;]+)/i);
    return bareMatch?.[1]?.trim();
};

@injectable()
export default class DownloadTeamClusterRemoteExplorerObjectUseCase implements IUseCase<
    DownloadTeamClusterRemoteExplorerObjectInputDTO,
    DownloadTeamClusterRemoteExplorerObjectOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRemoteAccessSessionService)
        private readonly sessionService: TeamClusterRemoteAccessSessionService,

        @inject(TEAM_CLUSTER_TOKENS.RemoteExplorerDaemonGateway)
        private readonly remoteExplorerDaemonGateway: RemoteExplorerDaemonGateway
    ) {}

    async execute(
        input: DownloadTeamClusterRemoteExplorerObjectInputDTO
    ): Promise<Result<DownloadTeamClusterRemoteExplorerObjectOutputDTO, ApplicationError>> {
        const preflight = await preflightRemoteExplorerAccess(
            this.teamClusterRepository,
            this.sessionService,
            input
        );
        if (preflight instanceof ApplicationError) {
            return Result.fail(preflight);
        }

        try {
            const response = await this.remoteExplorerDaemonGateway.downloadObject({
                teamClusterId: preflight.teamClusterId,
                target: preflight.target,
                path: input.path
            });

            const contentType = response.headers['content-type'] || 'application/octet-stream';
            const contentLengthHeader = response.headers['content-length'];
            const contentLength = typeof contentLengthHeader === 'string'
                ? Number(contentLengthHeader)
                : undefined;

            const filename = readFilenameFromContentDisposition(response.headers['content-disposition'])
                || deriveFallbackFilename(preflight.target, input.path);

            return Result.ok(createDownloadStreamResponse({
                stream: response.stream,
                contentType,
                filename,
                contentLength: typeof contentLength === 'number' && Number.isFinite(contentLength)
                    ? contentLength
                    : undefined,
                disposition: 'attachment'
            }));
        } catch (error: unknown) {
            if (
                error instanceof ApplicationError
                && error.code === ErrorCodes.TEAM_CLUSTER_DAEMON_STREAM_REQUEST_FAILED
                && error.statusCode === 404
            ) {
                return Result.fail(ApplicationError.notFound(
                    'TeamCluster::RemoteExplorerObjectNotFound',
                    'The requested remote explorer object was not found'
                ));
            }

            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(ApplicationError.badRequest(
                'TeamCluster::RemoteExplorerDownloadFailed',
                error instanceof Error ? error.message : 'Failed to download remote explorer object'
            ));
        }
    }
};
