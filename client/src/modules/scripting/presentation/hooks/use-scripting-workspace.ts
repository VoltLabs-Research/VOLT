import { useEffect, useState } from 'react';
import { container } from 'tsyringe';
import type { ScriptingNotebookDTO } from '@/modules/scripting/application/dtos';
import type IScriptingRepository from '@/modules/scripting/domain/ports/IScriptingRepository';
import { SCRIPTING_TOKENS } from '@/modules/scripting/infrastructure/di/tokens';

interface UseScriptingWorkspaceInput {
    trajectoryId: string;
    notebookId?: string;
}

const WORKSPACE_NOTEBOOKS_FETCH_LIMIT = 500;
const JUPYTER_START_ERROR_MESSAGE = 'Failed to start Jupyter';

const resolveJupyterUrlWithServerIp = (url: string): string => {
    try {
        const parsedUrl = new URL(url);
        const serverUrl = new URL(import.meta.env.VITE_API_URL);
        parsedUrl.protocol = serverUrl.protocol;
        parsedUrl.hostname = serverUrl.hostname;
        return parsedUrl.toString();
    } catch {
        return url;
    }
};

const pickActiveNotebook = (notebooks: ScriptingNotebookDTO[], notebookId?: string): ScriptingNotebookDTO | undefined => {
    if (!notebookId) {
        return notebooks[0];
    }

    return notebooks.find((notebook) => notebook.id === notebookId) || notebooks[0];
};

const getJupyterStartErrorMessage = (error: unknown): string => {
    if (typeof error === 'object' && error !== null) {
        const responseMessage = (error as any)?.response?.data?.message;
        if (typeof responseMessage === 'string' && responseMessage.trim().length > 0) {
            return responseMessage;
        }

        const message = (error as any)?.message;
        if (typeof message === 'string' && message.trim().length > 0) {
            return message;
        }
    }

    return JUPYTER_START_ERROR_MESSAGE;
};

const useScriptingWorkspace = ({ trajectoryId, notebookId }: UseScriptingWorkspaceInput) => {
    const [notebooks, setNotebooks] = useState<ScriptingNotebookDTO[]>([]);
    const [jupyterUrl, setJupyterUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isStartingJupyter, setIsStartingJupyter] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [startAttempt, setStartAttempt] = useState(0);

    const activeNotebook = pickActiveNotebook(notebooks, notebookId);

    useEffect(() => {
        let cancelled = false;

        const loadWorkspaceNotebooks = async () => {
            if (!trajectoryId) {
                if (!cancelled) {
                    setNotebooks([]);
                    setIsLoading(false);
                }
                return;
            }

            setIsLoading(true);

            try {
                const scriptingRepository = container.resolve<IScriptingRepository>(SCRIPTING_TOKENS.ScriptingRepository);
                const result = await scriptingRepository.listScriptingNotebooks({
                    trajectoryId,
                    page: 1,
                    limit: WORKSPACE_NOTEBOOKS_FETCH_LIMIT
                });

                if (!cancelled) {
                    setNotebooks(result.data);
                }
            } catch (err) {
                console.error(err);
                if (!cancelled) {
                    setNotebooks([]);
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        void loadWorkspaceNotebooks();

        return () => {
            cancelled = true;
        };
    }, [trajectoryId]);

    useEffect(() => {
        setJupyterUrl(null);
        setError(null);

        if (!trajectoryId) {
            setIsStartingJupyter(false);
            return;
        }

        let cancelled = false;

        const startJupyterSession = async () => {
            setIsStartingJupyter(true);

            try {
                const scriptingRepository = container.resolve<IScriptingRepository>(SCRIPTING_TOKENS.ScriptingRepository);
                const session = await scriptingRepository.createScriptingJupyterSession({
                    trajectoryId,
                    notebookId: activeNotebook?.id
                });

                if (cancelled) return;

                if (session.jupyter.ready) {
                    setJupyterUrl(resolveJupyterUrlWithServerIp(session.jupyter.url));
                } else {
                    setError('Jupyter is still starting. Please retry in a moment.');
                }
            } catch (err) {
                if (!cancelled) {
                    setError(getJupyterStartErrorMessage(err));
                }
            } finally {
                if (!cancelled) {
                    setIsStartingJupyter(false);
                }
            }
        };

        void startJupyterSession();

        return () => {
            cancelled = true;
        };
    }, [trajectoryId, activeNotebook?.id, startAttempt]);

    const retryStartJupyter = () => {
        if (!trajectoryId || isStartingJupyter) {
            return;
        }

        setStartAttempt((value) => value + 1);
    };

    return {
        isLoading,
        activeNotebook,
        isStartingJupyter,
        error,
        jupyterUrl,
        retryStartJupyter
    };
};

export default useScriptingWorkspace;
