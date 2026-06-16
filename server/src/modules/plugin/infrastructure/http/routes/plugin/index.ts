import controllers from '@modules/plugin/infrastructure/http/controllers/plugin';

import { ErrorCodes } from '@core/constants/error-codes';
import { Resource } from '@core/constants/resources';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

const IMPORT_MAX_FILE_SIZE = 100 * 1024 * 1024;

const importUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: IMPORT_MAX_FILE_SIZE
    }
});

/**
 * Caps the in-memory import buffer at {@link IMPORT_MAX_FILE_SIZE}. multer aborts
 * streaming once the cap is exceeded, so an oversized (or zip-bomb) upload never
 * gets fully buffered + unzipped in RAM. A `MulterError` carries no `statusCode`,
 * so it would normalize to a 500 in the global error middleware — surface the
 * size violation as a 400 here instead (matching `uploadChatSingleFile`) and let
 * every other error propagate unchanged.
 */
const importUploadSingleFile = (fieldName: string) => (
    request: Request,
    response: Response,
    next: NextFunction
) => {
    importUpload.single(fieldName)(request, response, (error: unknown) => {
        if (!error) {
            return next();
        }

        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
            return BaseResponse.error(
                response,
                'File exceeds the allowed upload size.',
                HttpStatus.BadRequest,
                ErrorCodes.FILE_READ_ERROR
            );
        }

        return next(error);
    });
};

export default createHttpModule({
    basePath: '/api/plugins/:teamId',
    resource: Resource.PLUGIN,
    teamScope: HttpModuleTeamScope.BasePath,
    moduleKey: 'plugin',
    routes: (router) => {
        router.get('/node-types/schema', controllers.getNodeTypesSchema.handle);
        router.post('/workflow-validation', controllers.validateWorkflow.handle);
        router.get('/:pluginId/export', controllers.exportPlugin.handle);
        router.post('/import', importUploadSingleFile('file'), controllers.importPlugin.handle);
        router.get('/registry/search', controllers.searchRegistry.handle);
        router.post('/registry/install', controllers.installRegistry.handle);
        router.route('/')
            .get(controllers.listPlugins.handle)
            .post(controllers.create.handle);
        router.post(
            '/:pluginId/binary/commit',
            controllers.commitBinaryUpload.handle
        );
        router.route('/:pluginId/binary')
            .get(controllers.downloadBinary.handle)
            .patch(controllers.uploadBinary.handle)
            .delete(controllers.deleteBinary.handle);
        router.post('/:pluginId/clones', controllers.clone.handle);
        router.route('/:pluginId')
            .get(controllers.getPluginById.handle)
            .patch(controllers.updatePluginById.handle)
            .delete(controllers.deleteById.handle);
        router.post(
            '/trajectories/:trajectoryId/pipeline-executions',
            controllers.executePipeline.handle
        );
    }
});
