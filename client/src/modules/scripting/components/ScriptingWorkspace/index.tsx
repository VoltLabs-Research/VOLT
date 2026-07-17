import ScriptingNotebookDeploymentModal from '@/modules/scripting/components/ScriptingNotebookDeploymentModal';
import useScriptingWorkspace from '@/modules/scripting/hooks/use-scripting-workspace';
import useTip from '@/shared/tips/use-tip';
import AccessDenied from '@/shared/ui/components/AccessDenied';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { AsyncBoundary, Box, Button, Heading, Loader, Stack, Text } from '@voltstack/bravais';
import './ScriptingWorkspace.css';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { NotebookContainerStage } from '@/modules/scripting/api/types/scripting-session';

interface ScriptingWorkspaceProps {
    trajectoryId: string;
    notebookId?: string;
    onJupyterUrlChange?: (url: string | null) => void;
    onNotebookIdChange?: (notebookId: string) => void;
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
    <Stack align='center' justify='center' gap='1' flex='1' p='2' textAlign='center' className='scripting-workspace__empty' role={liveMode === 'alert' ? 'alert' : 'status'} aria-live={liveMode === 'alert' ? 'assertive' : 'polite'} aria-atomic='true'>
        <Loader scale={0.6} isFixed={false} />
        <Stack align='center' gap='05' className='scripting-workspace__content'>
            <Heading level={2} size='lg' weight='medium'>
                {title}
            </Heading>
            <Text as='p' tone='secondary' className='scripting-workspace__description'>
                {description}
            </Text>
        </Stack>
        {children}
    </Stack>
);

const renderWorkspaceShell = (content: ReactNode, isBusy = false) => (
    <Stack flex='1' minH='0' className='scripting-workspace' aria-busy={isBusy}>
        <Box display='flex' flex='1' minH='0' position='relative' className='scripting-workspace__panel'>
            {content}
        </Box>
    </Stack>
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

const ScriptingWorkspace = ({ trajectoryId, notebookId, onJupyterUrlChange, onNotebookIdChange }: ScriptingWorkspaceProps) => {
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
    } = useScriptingWorkspace({ trajectoryId, notebookId, onNotebookIdChange });

    useEffect(() => {
        onJupyterUrlChange?.(jupyterUrl);

        return () => {
            onJupyterUrlChange?.(null);
        };
    }, [jupyterUrl, onJupyterUrlChange]);

    const loadingView = renderWorkspaceShell(renderWorkspaceState({
        title: 'Loading scripting workspace',
        description: 'Fetching notebooks and preparing your workspace.',
        liveMode: 'status'
    }), true);

    const accessDeniedView = renderWorkspaceShell(
        <AccessDenied description={accessDeniedMessage} showBack={false} className='w-full h-full' />
    );

    const isDeploymentRequired = Boolean(deploymentRequiredMessage);
    const errorValue = error || deploymentRequiredMessage;

    const deploymentRequiredView = renderWorkspaceShell(
        <RecoveryState
            tone={RecoveryStateTone.Info}
            title={activeNotebook ? 'Connect this notebook to a cluster' : 'Create a notebook workspace'}
            description={deploymentRequiredMessage
                || 'Notebooks run on a compute cluster. Connect or select one to start.'}
            retryLabel={activeNotebook ? 'Configure notebook' : 'Choose a cluster'}
            onRetry={isStartingJupyter ? undefined : retryStartJupyter}
            isRetrying={isStartingJupyter}
            className='w-full h-full'
        />
    );

    const errorView = () => {
        if (isDeploymentRequired) {
            return deploymentRequiredView;
        }

        return renderWorkspaceShell(renderWorkspaceState({
            title: 'Unable to start the notebook workspace',
            description: error || '',
            liveMode: 'alert',
            children: !isStartingJupyter ? (
                <Button
                    variant='outline'
                    intent='neutral'
                    size='sm'
                    shape='rounded'
                    onClick={retryStartJupyter}
                >
                    Retry starting Jupyter
                </Button>
            ) : undefined
        }));
    };

    let contentView: ReactNode;
    if (jupyterUrl) {
        contentView = renderWorkspaceShell(
            <Box display='flex' flex='1' position='relative' className='scripting-workspace__notebook-view'>
                <iframe src={jupyterUrl} title='Volt scripting notebook workspace' className='scripting-workspace__iframe' />
            </Box>
        );
    } else {
        const pendingTitle = isStartingJupyter
            ? getContainerStagePendingTitle(containerStage)
            : 'Preparing scripting workspace';
        const pendingDescription = isStartingJupyter
            ? getContainerStagePendingDescription(containerStage)
            : activeNotebook
                ? 'Opening the selected notebook in Jupyter. This can take a moment.'
                : 'No notebook is selected yet. Opening the shared Jupyter workspace for this trajectory.';

        contentView = renderWorkspaceShell(renderWorkspaceState({
            title: pendingTitle,
            description: pendingDescription,
            liveMode: 'status'
        }), true);
    }

    const shouldRenderDeploymentModal = !isLoading && !accessDenied && !jupyterUrl;

    return (
        <>
            <AsyncBoundary
                state={{ loading: isLoading, error: errorValue, accessDenied }}
                loading={loadingView}
                error={errorView}
                accessDenied={accessDeniedView}
            >
                {contentView}
            </AsyncBoundary>
            {shouldRenderDeploymentModal && (
                <ScriptingNotebookDeploymentModal
                    request={deploymentModalRequest}
                    onClose={handleDeploymentModalClose}
                />
            )}
        </>
    );
};

export default ScriptingWorkspace;
