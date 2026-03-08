import useScriptingWorkspace from '@/modules/scripting/hooks/use-scripting-workspace';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import Paragraph from '@/shared/presentation/components/Paragraph';
import './ScriptingWorkspace.css';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

interface ScriptingWorkspaceProps {
    trajectoryId: string;
    notebookId?: string;
    onJupyterUrlChange?: (url: string | null) => void;
};

const renderLoadingState = (message: string) => (
    <Container className="scripting-workspace__empty d-flex column items-center content-center gap-1 flex-1 p-2">
        <Loader scale={0.6} isFixed={false} />
        <Paragraph className="color-muted mt-1">{message}</Paragraph>
    </Container>
);

const renderWorkspaceShell = (content: ReactNode) => (
    <Container className="scripting-workspace d-flex column flex-1 min-h-0">
        <Container className="scripting-workspace__panel d-flex flex-1 min-h-0 p-relative">
            {content}
        </Container>
    </Container>
);

const ScriptingWorkspace = ({ trajectoryId, notebookId, onJupyterUrlChange }: ScriptingWorkspaceProps) => {
    const {
        isLoading,
        activeNotebook,
        isStartingJupyter,
        error,
        accessDenied,
        accessDeniedMessage,
        jupyterUrl,
        retryStartJupyter
    } = useScriptingWorkspace({ trajectoryId, notebookId });

    useEffect(() => {
        onJupyterUrlChange?.(jupyterUrl);

        return () => {
            onJupyterUrlChange?.(null);
        };
    }, [jupyterUrl, onJupyterUrlChange]);

    if (isLoading) {
        return renderLoadingState('Loading scripting workspace...');
    }

    if (accessDenied) {
        return renderWorkspaceShell(
            <AccessDenied description={accessDeniedMessage} showBack={false} className='w-full h-full' />
        );
    }

    if (jupyterUrl) {
        return renderWorkspaceShell(
            <Container className="scripting-workspace__notebook-view p-relative d-flex flex-1">
                <iframe src={jupyterUrl} title="Volt Scripting Jupyter" className="scripting-workspace__iframe" />
            </Container>
        );
    }

    return renderWorkspaceShell(
        <Container className="scripting-workspace__empty d-flex column items-center content-center gap-1 flex-1 p-2">
            {!error && (
                <>
                    <Loader scale={0.6} isFixed={false} />
                    <Paragraph className="color-muted mt-1">
                        {isStartingJupyter ? 'Starting Jupyter session...' : 'Jupyter session pending...'}
                    </Paragraph>
                    {!activeNotebook && (
                        <Paragraph className="color-muted">
                            No notebook selected. Opening Jupyter workspace...
                        </Paragraph>
                    )}
                </>
            )}
            {error && <Paragraph className="scripting-workspace__error">{error}</Paragraph>}
            {error && !isStartingJupyter && (
                <Button
                    variant="outline"
                    intent="neutral"
                    size="sm"
                    shape="rounded"
                    onClick={retryStartJupyter}
                >
                    Retry Start Jupyter
                </Button>
            )}
        </Container>
    );
};

export default ScriptingWorkspace;
