import {
    containerIdParamSchema,
    containerPathQuerySchema,
    createContainerSchema,
    updateContainerSchema,
    writeContainerFileSchema
} from '../validation/schemas';
import { parseValue, sendError, sendSuccess } from '../common';
import express from 'express';
import type { DockerRuntimeService } from '../../infrastructure/docker/DockerRuntimeService';

export const createContainersRouter = (dockerRuntimeService: DockerRuntimeService) => {
    const router = express.Router();

    router.get('/api/containers', async (req, res) => {
        try {
            const all = req.query.all === undefined ? true : req.query.all === 'true';
            sendSuccess(res, await dockerRuntimeService.listContainers(all));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.post('/api/containers', async (req, res) => {
        try {
            const requestBody = parseValue(createContainerSchema, req.body);
            const container = await dockerRuntimeService.createContainer(requestBody);
            sendSuccess(res, container, 201);
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.get('/api/containers/:containerId', async (req, res) => {
        try {
            const params = parseValue(containerIdParamSchema, req.params);
            sendSuccess(res, await dockerRuntimeService.getContainer(params.containerId));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.patch('/api/containers/:containerId', async (req, res) => {
        try {
            const params = parseValue(containerIdParamSchema, req.params);
            const requestBody = parseValue(updateContainerSchema, req.body);
            const container = await dockerRuntimeService.applyContainerAction(params.containerId, requestBody.action);
            sendSuccess(res, container);
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.delete('/api/containers/:containerId', async (req, res) => {
        try {
            const params = parseValue(containerIdParamSchema, req.params);
            await dockerRuntimeService.deleteContainer(params.containerId);
            sendSuccess(res, { deleted: true });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.get('/api/containers/:containerId/files', async (req, res) => {
        try {
            const params = parseValue(containerIdParamSchema, req.params);
            const query = parseValue(containerPathQuerySchema, req.query);
            sendSuccess(res, await dockerRuntimeService.getContainerFiles(params.containerId, query.path || '/'));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.get('/api/containers/:containerId/file', async (req, res) => {
        try {
            const params = parseValue(containerIdParamSchema, req.params);
            const query = parseValue(containerPathQuerySchema.extend({ path: containerPathQuerySchema.shape.path.unwrap() }), req.query);
            const fileContents = await dockerRuntimeService.readContainerFile(params.containerId, query.path);
            sendSuccess(res, {
                contents: fileContents
            });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.put('/api/containers/:containerId/file', async (req, res) => {
        try {
            const params = parseValue(containerIdParamSchema, req.params);
            const requestBody = parseValue(writeContainerFileSchema, req.body);
            await dockerRuntimeService.writeContainerFile(params.containerId, requestBody.path, requestBody.content);
            sendSuccess(res, { written: true });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.get('/api/containers/:containerId/processes', async (req, res) => {
        try {
            const params = parseValue(containerIdParamSchema, req.params);
            sendSuccess(res, await dockerRuntimeService.getContainerProcesses(params.containerId));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.get('/api/containers/:containerId/stats', async (req, res) => {
        try {
            const params = parseValue(containerIdParamSchema, req.params);
            sendSuccess(res, await dockerRuntimeService.getContainerStats(params.containerId));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    return router;
};
