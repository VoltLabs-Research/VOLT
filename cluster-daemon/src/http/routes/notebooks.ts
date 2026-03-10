import {
    createNotebookSchema,
    createNotebookSessionSchema,
    notebookIdParamSchema,
    notebooksQuerySchema,
    updateNotebookSchema
} from '../validation/schemas';
import { copyHeaders, parseValue, readProxyRequestBody, sendError, sendSuccess } from '../common';
import express from 'express';
import type { NotebookRepository } from '../../infrastructure/mongo/repositories/NotebookRepository';
import type { JupyterRuntimeService } from '../../modules/jupyter/JupyterRuntimeService';

export const createNotebooksRouter = (
    notebookRepository: NotebookRepository,
    jupyterRuntimeService: JupyterRuntimeService
) => {
    const router = express.Router();

    router.get('/api/notebooks', async (req, res) => {
        try {
            const query = parseValue(notebooksQuerySchema, req.query);
            sendSuccess(res, await notebookRepository.listNotebooks(query.teamId));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.post('/api/notebooks', async (req, res) => {
        try {
            const requestBody = parseValue(createNotebookSchema, req.body);
            sendSuccess(res, await notebookRepository.createNotebook(requestBody), 201);
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.patch('/api/notebooks/:notebookId', async (req, res) => {
        try {
            const params = parseValue(notebookIdParamSchema, req.params);
            const requestBody = parseValue(updateNotebookSchema, req.body);
            sendSuccess(res, await notebookRepository.updateNotebook(params.notebookId, requestBody));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.delete('/api/notebooks/:notebookId', async (req, res) => {
        try {
            const params = parseValue(notebookIdParamSchema, req.params);
            await jupyterRuntimeService.deleteSession(params.notebookId);
            sendSuccess(res, {
                deleted: await notebookRepository.deleteNotebook(params.notebookId)
            });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.post('/api/notebooks/:notebookId/sessions', async (req, res) => {
        try {
            const params = parseValue(notebookIdParamSchema, req.params);
            const requestBody = parseValue(createNotebookSessionSchema, req.body);
            const notebook = await notebookRepository.getNotebookById(params.notebookId);
            if (!notebook) {
                throw new Error('Notebook not found');
            }

            sendSuccess(res, await jupyterRuntimeService.ensureSession({
                notebook,
                requestedBy: requestBody.requestedBy
            }), 201);
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.get('/api/notebooks/:notebookId/runtime', async (req, res) => {
        try {
            const params = parseValue(notebookIdParamSchema, req.params);
            sendSuccess(res, {
                hostPort: await jupyterRuntimeService.getRuntimeHostPort(params.notebookId)
            });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.use('/api/notebooks/proxy/:notebookId', async (req, res) => {
        try {
            const params = parseValue(notebookIdParamSchema, req.params);
            const hostPort = await jupyterRuntimeService.getRuntimeHostPort(params.notebookId);
            if (!hostPort) {
                throw new Error('Jupyter runtime is not available');
            }

            const requestUrl = new URL(req.originalUrl, 'http://daemon.local');
            const proxyPrefix = `/api/notebooks/proxy/${encodeURIComponent(params.notebookId)}`;
            const normalizedProxyPath = requestUrl.pathname.startsWith(proxyPrefix)
                ? requestUrl.pathname.slice(proxyPrefix.length) || '/'
                : '/';
            const targetUrl = `http://127.0.0.1:${hostPort}${normalizedProxyPath}${requestUrl.search}`;
            const requestHeaders = new Headers();

            for (const [headerName, headerValue] of Object.entries(req.headers)) {
                if (!headerValue || headerName.toLowerCase() === 'host') {
                    continue;
                }

                if (Array.isArray(headerValue)) {
                    requestHeaders.set(headerName, headerValue.join(', '));
                } else {
                    requestHeaders.set(headerName, headerValue);
                }
            }

            const response = await fetch(targetUrl, {
                method: req.method,
                headers: requestHeaders,
                body: readProxyRequestBody(req)
            });

            res.status(response.status);
            copyHeaders(response.headers, res);

            if (!response.body) {
                res.end();
                return;
            }

            const reader = response.body.getReader();
            while (true) {
                const chunk = await reader.read();
                if (chunk.done) {
                    break;
                }

                res.write(Buffer.from(chunk.value));
            }

            res.end();
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    return router;
};
