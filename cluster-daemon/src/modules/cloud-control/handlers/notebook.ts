import type { NotebookRepository } from '../../jupyter/repositories';
import type { JupyterRuntimeService } from '../../jupyter/services';
import type { ReverseChannelCommandHandler } from '../services';
import { readString } from './payloadValidation';

interface NotebookHandlersDependencies {
    notebookRepository: NotebookRepository;
    jupyterRuntimeService: JupyterRuntimeService;
}

export const createNotebookHandlers = (deps: NotebookHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: 'notebook.create',
        execute: async (payload) => ({
            data: await deps.notebookRepository.createNotebook(payload as never),
            status: 201
        })
    },
    {
        command: 'notebook.delete',
        execute: async (payload) => {
            const notebookId = readString(payload?.notebookId, 'notebookId');
            await deps.jupyterRuntimeService.deleteSession(notebookId);
            return { data: { deleted: await deps.notebookRepository.deleteNotebook(notebookId) } };
        }
    },
    {
        command: 'notebook.runtime.get',
        execute: async (payload) => ({
            data: {
                hostPort: await deps.jupyterRuntimeService.getRuntimeHostPort(
                    readString(payload?.notebookId, 'notebookId')
                )
            }
        })
    },
    {
        command: 'notebook.session.create',
        execute: async (payload) => {
            const notebookId = readString(payload?.notebookId, 'notebookId');
            const notebook = await deps.notebookRepository.getNotebookById(notebookId);
            if (!notebook) {
                throw new Error('Notebook not found');
            }

            return {
                data: await deps.jupyterRuntimeService.ensureSession({
                    notebook,
                    requestedBy: readString(payload?.requestedBy, 'requestedBy')
                }),
                status: 201
            };
        }
    },
    {
        command: 'notebook.proxy.http',
        execute: async (payload) => {
            const notebookId = readString(payload?.notebookId, 'notebookId');
            const hostPort = await deps.jupyterRuntimeService.getRuntimeHostPort(notebookId);
            if (!hostPort) {
                throw new Error('Jupyter runtime is not available');
            }

            const proxiedPath = typeof payload?.proxiedPath === 'string' ? payload.proxiedPath : '/';
            const rawQuery = typeof payload?.rawQuery === 'string' ? payload.rawQuery : '';
            const targetUrl = `http://127.0.0.1:${hostPort}${proxiedPath}${rawQuery}`;
            const headers = typeof payload?.headers === 'object' && payload.headers !== null
                ? payload.headers as Record<string, string>
                : undefined;
            const response = await fetch(targetUrl, {
                method: typeof payload?.method === 'string' ? payload.method : 'GET',
                headers,
                body: typeof payload?.body === 'object' && payload.body !== null
                    ? JSON.stringify(payload.body)
                    : undefined
            });
            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });

            return {
                status: response.status,
                headers: responseHeaders,
                stream: response.body || undefined
            };
        }
    }
];
