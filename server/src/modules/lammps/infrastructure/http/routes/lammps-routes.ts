import { Resource } from '@core/constants/resources';
import { LammpsService } from '@modules/lammps/services/LammpsService';
import { upload } from '@shared/infrastructure/http/middleware/upload';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { container } from 'tsyringe';
import type { Response } from 'express';

const lammpsService = (): LammpsService => {
    return container.resolve(LammpsService);
};

const readRequiredTeamId = (request: AuthenticatedRequest): string => {
    return String(request.params.teamId);
};

const readRequiredUserId = (request: AuthenticatedRequest): string => {
    if (!request.userId) {
        throw new Error('Authenticated user id is required');
    }

    return request.userId;
};

const readQueryInt = (value: unknown): number | undefined => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const handle = (
    callback: (request: AuthenticatedRequest, response: Response) => Promise<void>
) => {
    return async (request: AuthenticatedRequest, response: Response) => {
        try {
            await callback(request, response);
        } catch (error) {
            BaseResponse.fromError(response, error);
        }
    };
};

export default createHttpModule({
    basePath: '/api/lammps/:teamId',
    resource: Resource.LAMMPS,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/packages', handle(async (_request, response) => {
            BaseResponse.success(response, lammpsService().getAvailablePackages());
        }));

        router.get('/run-clusters', handle(async (request, response) => {
            BaseResponse.success(response, await lammpsService().listRunClusters({
                teamId: readRequiredTeamId(request)
            }));
        }));

        router.get('/containers', handle(async (request, response) => {
            BaseResponse.paginated(response, await lammpsService().listContainers({
                teamId: readRequiredTeamId(request),
                page: readQueryInt(request.query.page),
                limit: readQueryInt(request.query.limit),
                search: typeof request.query.search === 'string' ? request.query.search : undefined
            }));
        }));

        router.post('/containers', handle(async (request, response) => {
            BaseResponse.success(response, await lammpsService().createContainer({
                teamId: readRequiredTeamId(request),
                userId: readRequiredUserId(request),
                name: String(request.body?.name || ''),
                packages: Array.isArray(request.body?.packages) ? request.body.packages : [],
                teamClusterId: typeof request.body?.teamClusterId === 'string'
                    ? request.body.teamClusterId
                    : undefined,
                cpus: typeof request.body?.cpus === 'number'
                    ? request.body.cpus
                    : undefined
            }), 201);
        }));

        router.get('/containers/:containerId', handle(async (request, response) => {
            BaseResponse.success(response, await lammpsService().getContainer({
                teamId: readRequiredTeamId(request),
                containerId: String(request.params.containerId)
            }));
        }));

        router.delete('/containers/:containerId', handle(async (request, response) => {
            await lammpsService().deleteContainer({
                teamId: readRequiredTeamId(request),
                containerId: String(request.params.containerId)
            });
            BaseResponse.success(response, { deleted: true });
        }));

        router.get('/folders', handle(async (request, response) => {
            BaseResponse.paginated(response, await lammpsService().listFolders({
                teamId: readRequiredTeamId(request),
                page: readQueryInt(request.query.page),
                limit: readQueryInt(request.query.limit),
                parentId: typeof request.query.parentId === 'string'
                    ? request.query.parentId
                    : null
            }));
        }));

        router.post('/folders', handle(async (request, response) => {
            BaseResponse.success(response, await lammpsService().createFolder({
                teamId: readRequiredTeamId(request),
                userId: readRequiredUserId(request),
                title: String(request.body?.title || ''),
                parentId: typeof request.body?.parentId === 'string'
                    ? request.body.parentId
                    : null
            }), 201);
        }));

        router.patch('/folders/:folderId', handle(async (request, response) => {
            BaseResponse.success(response, await lammpsService().updateFolder({
                teamId: readRequiredTeamId(request),
                folderId: String(request.params.folderId),
                title: String(request.body?.title || '')
            }));
        }));

        router.delete('/folders/:folderId', handle(async (request, response) => {
            await lammpsService().deleteFolder({
                teamId: readRequiredTeamId(request),
                folderId: String(request.params.folderId)
            });
            BaseResponse.success(response, { deleted: true });
        }));

        router.get('/scripts', handle(async (request, response) => {
            BaseResponse.paginated(response, await lammpsService().listScripts({
                teamId: readRequiredTeamId(request),
                page: readQueryInt(request.query.page),
                limit: readQueryInt(request.query.limit),
                search: typeof request.query.search === 'string' ? request.query.search : undefined,
                folderId: typeof request.query.folderId === 'string' ? request.query.folderId : null
            }));
        }));

        router.post('/scripts', handle(async (request, response) => {
            BaseResponse.success(response, await lammpsService().createScript({
                teamId: readRequiredTeamId(request),
                userId: readRequiredUserId(request),
                title: String(request.body?.title || ''),
                containerId: String(request.body?.containerId || ''),
                folderId: typeof request.body?.folderId === 'string' ? request.body.folderId : null
            }), 201);
        }));

        router.get('/scripts/:scriptId', handle(async (request, response) => {
            BaseResponse.success(response, await lammpsService().getScript({
                teamId: readRequiredTeamId(request),
                scriptId: String(request.params.scriptId)
            }));
        }));

        router.patch('/scripts/:scriptId', handle(async (request, response) => {
            BaseResponse.success(response, await lammpsService().updateScript({
                teamId: readRequiredTeamId(request),
                scriptId: String(request.params.scriptId),
                title: typeof request.body?.title === 'string'
                    ? request.body.title
                    : undefined,
                mpiRanks: typeof request.body?.mpiRanks === 'number'
                    ? request.body.mpiRanks
                    : undefined,
                openmpThreads: typeof request.body?.openmpThreads === 'number'
                    ? request.body.openmpThreads
                    : undefined,
                threads: typeof request.body?.threads === 'number'
                    ? request.body.threads
                    : undefined
            }));
        }));

        router.delete('/scripts/:scriptId', handle(async (request, response) => {
            await lammpsService().deleteScript({
                teamId: readRequiredTeamId(request),
                scriptId: String(request.params.scriptId)
            });
            BaseResponse.success(response, { deleted: true });
        }));

        router.patch('/scripts/:scriptId/folder', handle(async (request, response) => {
            BaseResponse.success(response, await lammpsService().moveScript({
                teamId: readRequiredTeamId(request),
                scriptId: String(request.params.scriptId),
                folderId: typeof request.body?.folderId === 'string' ? request.body.folderId : null
            }));
        }));

        router.get('/scripts/:scriptId/workspace', handle(async (request, response) => {
            BaseResponse.success(response, await lammpsService().getWorkspace({
                teamId: readRequiredTeamId(request),
                scriptId: String(request.params.scriptId),
                selectedExecutionId: typeof request.query.selectedExec === 'string'
                    ? request.query.selectedExec
                    : undefined
            }));
        }));

        router.get('/scripts/:scriptId/files', handle(async (request, response) => {
            BaseResponse.success(response, await lammpsService().listScriptFiles({
                teamId: readRequiredTeamId(request),
                scriptId: String(request.params.scriptId)
            }));
        }));

        router.get('/scripts/:scriptId/files/content', handle(async (request, response) => {
            BaseResponse.success(response, await lammpsService().readScriptFile({
                teamId: readRequiredTeamId(request),
                scriptId: String(request.params.scriptId),
                relativePath: String(request.query.path || '')
            }));
        }));

        router.put('/scripts/:scriptId/files/content', handle(async (request, response) => {
            await lammpsService().writeScriptFile({
                teamId: readRequiredTeamId(request),
                scriptId: String(request.params.scriptId),
                relativePath: String(request.body?.path || ''),
                content: String(request.body?.content || ''),
                userId: readRequiredUserId(request)
            });
            BaseResponse.success(response, { written: true });
        }));

        router.post('/scripts/:scriptId/files', handle(async (request, response) => {
            await lammpsService().createScriptEntry({
                teamId: readRequiredTeamId(request),
                scriptId: String(request.params.scriptId),
                relativePath: String(request.body?.path || ''),
                kind: request.body?.kind === 'directory' ? 'directory' : 'file',
                content: typeof request.body?.content === 'string' ? request.body.content : undefined,
                userId: readRequiredUserId(request)
            });
            BaseResponse.success(response, { created: true }, 201);
        }));

        router.patch('/scripts/:scriptId/files/move', handle(async (request, response) => {
            await lammpsService().moveScriptEntry({
                teamId: readRequiredTeamId(request),
                scriptId: String(request.params.scriptId),
                sourcePath: String(request.body?.sourcePath || ''),
                destinationPath: String(request.body?.destinationPath || ''),
                userId: readRequiredUserId(request)
            });
            BaseResponse.success(response, { moved: true });
        }));

        router.delete('/scripts/:scriptId/files', handle(async (request, response) => {
            await lammpsService().deleteScriptEntry({
                teamId: readRequiredTeamId(request),
                scriptId: String(request.params.scriptId),
                relativePath: typeof request.body?.path === 'string'
                    ? request.body.path
                    : String(request.query.path || ''),
                userId: readRequiredUserId(request)
            });
            BaseResponse.success(response, { deleted: true });
        }));

        router.post('/scripts/:scriptId/files/upload', upload.array('files', 20), handle(async (request, response) => {
            const files = Array.isArray(request.files)
                ? request.files.map((file) => ({
                    originalname: file.originalname,
                    buffer: file.buffer
                }))
                : [];

            await lammpsService().uploadScriptFiles({
                teamId: readRequiredTeamId(request),
                scriptId: String(request.params.scriptId),
                destinationPath: typeof request.body?.destinationPath === 'string'
                    ? request.body.destinationPath
                    : '',
                files,
                userId: readRequiredUserId(request)
            });
            BaseResponse.success(response, { uploaded: true }, 201);
        }));

        router.get('/scripts/:scriptId/executions', handle(async (request, response) => {
            BaseResponse.success(response, await lammpsService().listScriptExecutions({
                teamId: readRequiredTeamId(request),
                scriptId: String(request.params.scriptId)
            }));
        }));

        router.post('/scripts/:scriptId/executions', handle(async (request, response) => {
            BaseResponse.success(response, await lammpsService().startExecution({
                teamId: readRequiredTeamId(request),
                scriptId: String(request.params.scriptId),
                userId: readRequiredUserId(request),
                requestedTeamClusterId: typeof request.body?.teamClusterId === 'string'
                    ? request.body.teamClusterId
                    : undefined
            }), 201);
        }));

        router.get('/executions', handle(async (request, response) => {
            BaseResponse.paginated(response, await lammpsService().listExecutions({
                teamId: readRequiredTeamId(request),
                page: readQueryInt(request.query.page),
                limit: readQueryInt(request.query.limit),
                search: typeof request.query.search === 'string' ? request.query.search : undefined
            }));
        }));

        router.get('/executions/:executionId', handle(async (request, response) => {
            BaseResponse.success(response, await lammpsService().getExecution({
                teamId: readRequiredTeamId(request),
                executionId: String(request.params.executionId)
            }));
        }));

        router.delete('/executions/:executionId', handle(async (request, response) => {
            await lammpsService().deleteExecution({
                teamId: readRequiredTeamId(request),
                executionId: String(request.params.executionId)
            });
            BaseResponse.success(response, { deleted: true });
        }));

        router.get('/executions/:executionId/dumps', handle(async (request, response) => {
            BaseResponse.success(response, await lammpsService().listExecutionDumps({
                teamId: readRequiredTeamId(request),
                executionId: String(request.params.executionId)
            }));
        }));

        router.get('/executions/:executionId/dumps/:dumpId/download', handle(async (request, response) => {
            const result = await lammpsService().downloadExecutionDump({
                teamId: readRequiredTeamId(request),
                executionId: String(request.params.executionId),
                dumpId: String(request.params.dumpId)
            });

            response.setHeader('Content-Type', 'application/octet-stream');
            response.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
            response.setHeader('Cache-Control', 'no-store');

            result.stream.on('error', (error: Error) => {
                response.destroy(error);
            });
            result.stream.pipe(response);
        }));

        router.delete('/executions/:executionId/dumps/:dumpId', handle(async (request, response) => {
            await lammpsService().deleteExecutionDump({
                teamId: readRequiredTeamId(request),
                executionId: String(request.params.executionId),
                dumpId: String(request.params.dumpId)
            });
            BaseResponse.success(response, { deleted: true });
        }));

        router.post('/executions/:executionId/stop', handle(async (request, response) => {
            await lammpsService().stopExecution({
                teamId: readRequiredTeamId(request),
                executionId: String(request.params.executionId)
            });
            BaseResponse.success(response, { accepted: true });
        }));

        router.post('/executions/:executionId/kill', handle(async (request, response) => {
            await lammpsService().killExecution({
                teamId: readRequiredTeamId(request),
                executionId: String(request.params.executionId)
            });
            BaseResponse.success(response, { accepted: true });
        }));

        router.post('/executions/:executionId/import-trajectory', handle(async (request, response) => {
            BaseResponse.success(response, await lammpsService().importExecutionAsTrajectory({
                teamId: readRequiredTeamId(request),
                executionId: String(request.params.executionId),
                userId: readRequiredUserId(request),
                name: String(request.body?.name || '')
            }), 201);
        }));

        router.get('/executions/:executionId/dumps/:timestep/glb', handle(async (request, response) => {
            const result = await lammpsService().getExecutionGlbStream({
                teamId: readRequiredTeamId(request),
                executionId: String(request.params.executionId),
                timestep: Number(request.params.timestep)
            });

            response.setHeader('Content-Type', 'model/gltf-binary');
            response.setHeader('Content-Disposition', `attachment; filename="${result.objectName}"`);
            response.setHeader('Cache-Control', 'no-store');

            result.stream.on('error', (error: Error) => {
                response.destroy(error);
            });
            result.stream.pipe(response);
        }));
    }
});
