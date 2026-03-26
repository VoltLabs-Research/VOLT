import ScriptingNotebookDeploymentModal from '@/modules/scripting/components/molecules/ScriptingNotebookDeploymentModal';
import useScriptingWorkspace from '@/modules/scripting/hooks/use-scripting-workspace';
import useTip from '@/shared/tips/use-tip';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import './ScriptingWorkspace.css';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { NotebookContainerStage } from '@/modules/scripting/api/entities/scripting-session';

interface ScriptingWorkspaceProps {
    trajectoryId: string;
    notebookId?: string;
    onJupyterUrlChange?: (url: string | null) => void;
};

interface WorkspaceStateProps {
    title: string;
    description: string;
    liveMode: 'alert' | 'status';
    children?: ReactNode;
};

const renderWorkspaceState = ({
    title,
    description,
    liveMode,
    children
}: WorkspaceStateProps) => (
    <Container
        className='scripting-workspace__empty d-flex column items-center content-center gap-1 flex-1 p-2 text-center'
        role={liveMode === 'alert' ? 'alert' : 'status'}
        aria-live={liveMode === 'alert' ? 'assertive' : 'polite'}
        aria-atomic='true'
    >
        <Loader scale={0.6} isFixed={false} />
        <Container className='d-flex column items-center gap-05 scripting-workspace__content'>
            <Title as='h2' className='font-size-3 font-weight-6 color-primary'>
                {title}
            </Title>
            <Paragraph className='color-secondary scripting-workspace__description'>
                {description}
            </Paragraph>
        </Container>
        {children}
    </Container>
);

const renderWorkspaceShell = (content: ReactNode, isBusy = false) => (
    <Container className='scripting-workspace d-flex column flex-1 min-h-0' aria-busy={isBusy}>
        <Container className='scripting-workspace__panel d-flex flex-1 min-h-0 p-relative'>
            {content}
        </Container>
    </Container>
);

const getContainerStagePendingTitle = (stage: NotebookContainerStage | null): string => {
    switch (stage) {
        case 'creating':
            return 'Creating container';
        case 'starting':
            return 'Starting container';
        default:
            return 'Preparing scripting workspace';
    }
};

const getContainerStagePendingDescription = (stage: NotebookContainerStage | null): string => {
    switch (stage) {
        case 'creating':
            return 'Setting up the Jupyter environment for this workspace.';
        case 'starting':
            return 'The container is initializing. Jupyter will be available shortly.';
        default:
            return 'Preparing the notebook environment. This can take a moment.';
    }
};

const ScriptingWorkspace = ({ trajectoryId, notebookId, onJupyterUrlChange }: ScriptingWorkspaceProps) => {
    useTip('notebook-workspace');

    const {
        isLoading,
        activeNotebook,
        isStartingJupyter,
        error,
        deploymentRequiredMessage,
        deploymentModalRequest,
        accessDenied,
        accessDeniedMessage,
        jupyterUrl,
        containerStage,
        handleDeploymentModalClose,
        retryStartJupyter
    } = useScriptingWorkspace({ trajectoryId, notebookId });

    useEffect(() => {
        onJupyterUrlChange?.(jupyterUrl);

        return () => {
            onJupyterUrlChange?.(null);
        };
    }, [jupyterUrl, onJupyterUrlChange]);

    if (isLoading) {
        return renderWorkspaceShell(renderWorkspaceState({
            title: 'Loading scripting workspace',
            description: 'Fetching notebooks and preparing your workspace.',
            liveMode: 'status'
        }), true);
    }

    if (accessDenied) {
        return renderWorkspaceShell(
            <AccessDenied description={accessDeniedMessage} showBack={false} className='w-full h-full' />
        );
    }

    if (jupyterUrl) {
        return renderWorkspaceShell(
            <Container className='scripting-workspace__notebook-view p-relative d-flex flex-1'>
                <iframe src={jupyterUrl} title='Volt scripting notebook workspace' className='scripting-workspace__iframe' />
            </Container>
        );
    }

    if (error || deploymentRequiredMessage) {
        const isDeploymentRequired = Boolean(deploymentRequiredMessage);

        return (
            <>
                {renderWorkspaceShell(renderWorkspaceState({
                    title: isDeploymentRequired
                        ? activeNotebook
                            ? 'Notebook deployment required'
                            : 'Create notebook workspace'
                        : 'Unable to start the notebook workspace',
                    description: deploymentRequiredMessage || error || '',
                    liveMode: 'alert',
                    children: !isStartingJupyter ? (
                        <Button
                            variant='outline'
                            intent='neutral'
                            size='sm'
                            shape='rounded'
                            onClick={retryStartJupyter}
                        >
                            {isDeploymentRequired ? 'Configure notebook' : 'Retry starting Jupyter'}
                        </Button>
                    ) : undefined
                }))}
                <ScriptingNotebookDeploymentModal
                    request={deploymentModalRequest}
                    onClose={handleDeploymentModalClose}
                />
            </>
        );
    }

    const pendingTitle = isStartingJupyter
        ? getContainerStagePendingTitle(containerStage)
        : 'Preparing scripting workspace';
    const pendingDescription = isStartingJupyter
        ? getContainerStagePendingDescription(containerStage)
        : activeNotebook
            ? 'Opening the selected notebook in Jupyter. This can take a moment.'
            : 'No notebook is selected yet. Opening the shared Jupyter workspace for this trajectory.';

    return (
        <>
            {renderWorkspaceShell(renderWorkspaceState({
                title: pendingTitle,
                description: pendingDescription,
                liveMode: 'status'
            }), true)}
            <ScriptingNotebookDeploymentModal
                request={deploymentModalRequest}
                onClose={handleDeploymentModalClose}
            />
        </>
    );
};

export default ScriptingWorkspace;
