import type ClusterHttpService from '@modules/cluster/application/ClusterHttpService';
import { CLUSTER_TOKENS } from '@modules/cluster/infrastructure/di/ClusterTokens';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';

/**
 * Public HTTP-facing method names on {@link ClusterHttpService} (every method
 * except the private `run` helper).
 */
type ClusterHttpMethod = {
    [K in keyof ClusterHttpService]: ClusterHttpService[K] extends (input: never) => Promise<unknown> ? K : never;
}[keyof ClusterHttpService];

/**
 * The request-derived input type a given service method expects. Lets each
 * handler cast `buildControllerParams` output to the exact use-case input shape
 * without the controller importing the use cases or their DTOs directly.
 */
type ClusterHttpInput<M extends ClusterHttpMethod> = Parameters<ClusterHttpService[M]>[0];

/**
 * The single HTTP controller for the cluster module. One Express handler per
 * route, assembling the use-case input exactly as `buildControllerParams` did
 * for the generated controllers, delegating to {@link ClusterHttpService}, and
 * responding via {@link BaseResponse}.
 *
 * `create` / `provisionDemo` preserve the former `HttpStatus.Created` responses;
 * `listByTeamId` / `listTransferJobs` preserve the paginated envelope
 * (`BaseResponse.paginated` with the result's `_meta`); and
 * `downloadRemoteExplorerObject` reproduces the former
 * `createPreparedDownloadStreamController` behaviour verbatim — it awaits the
 * prepared output's `prepare()`, applies the response's `headers`, wires the
 * request-close and stream-error handlers, then pipes the binary stream to the
 * response. Handlers are arrow-function properties so `this` stays bound when
 * passed by reference to the router. Thrown `ApplicationError`s propagate to
 * `httpErrorMiddleware` via Express 5 async forwarding.
 */
@injectable()
export default class ClusterController {
    constructor(
        @inject(CLUSTER_TOKENS.ClusterHttpService) private readonly clusterHttpService: ClusterHttpService
    ) {}

    private params<M extends ClusterHttpMethod>(req: AuthenticatedRequest): ClusterHttpInput<M> {
        return buildControllerParams(req) as unknown as ClusterHttpInput<M>;
    }

    create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.clusterHttpService.create(this.params<'create'>(req));
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    listByTeamId = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.clusterHttpService.listByTeamId(this.params<'listByTeamId'>(req));
        BaseResponse.paginated(res, value, value._meta);
    };

    provisionDemo = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.clusterHttpService.provisionDemo(this.params<'provisionDemo'>(req));
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    deleteDemo = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.clusterHttpService.deleteDemo(this.params<'deleteDemo'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    getDemoStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.clusterHttpService.getDemoStatus(this.params<'getDemoStatus'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    getById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.clusterHttpService.getById(this.params<'getById'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    getRuntimeSnapshot = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.clusterHttpService.getRuntimeSnapshot(this.params<'getRuntimeSnapshot'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    updateQueueConcurrency = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.clusterHttpService.updateQueueConcurrency(this.params<'updateQueueConcurrency'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    updateRole = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.clusterHttpService.updateRole(this.params<'updateRole'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    listTransferJobs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.clusterHttpService.listTransferJobs(this.params<'listTransferJobs'>(req));
        BaseResponse.paginated(res, value, value._meta);
    };

    createTransferRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.clusterHttpService.createTransferRequest(this.params<'createTransferRequest'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    getResourceLimits = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.clusterHttpService.getResourceLimits(this.params<'getResourceLimits'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    revealCredentials = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.clusterHttpService.revealCredentials(this.params<'revealCredentials'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    createRemoteAccessSession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.clusterHttpService.createRemoteAccessSession(this.params<'createRemoteAccessSession'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    listRemoteExplorerEntries = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.clusterHttpService.listRemoteExplorerEntries(this.params<'listRemoteExplorerEntries'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    getRemoteExplorerNode = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.clusterHttpService.getRemoteExplorerNode(this.params<'getRemoteExplorerNode'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    downloadRemoteExplorerObject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const output = await this.clusterHttpService.downloadRemoteExplorerObject(
            this.params<'downloadRemoteExplorerObject'>(req)
        );

        await output.prepare?.();

        for (const [name, value] of Object.entries(output.headers)) {
            res.setHeader(name, value);
        }

        res.on('close', () => {
            output.stream.destroy();
        });

        output.stream.on('error', (error: unknown) => {
            logger.error(error);

            if (!res.headersSent) {
                BaseResponse.fromError(res, error);
                return;
            }

            res.destroy(error instanceof Error ? error : undefined);
        });

        output.stream.pipe(res);
    };

    regenerateEnrollmentToken = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.clusterHttpService.regenerateEnrollmentToken(this.params<'regenerateEnrollmentToken'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    deleteById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.clusterHttpService.deleteById(this.params<'deleteById'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    processHealthcheck = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.clusterHttpService.processHealthcheck(this.params<'processHealthcheck'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    generateInstallManifest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.clusterHttpService.generateInstallManifest(this.params<'generateInstallManifest'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };
}
