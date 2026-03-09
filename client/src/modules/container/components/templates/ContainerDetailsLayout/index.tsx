import ContainerDetailsSkeleton from '../../atoms/ContainerDetailsSkeleton';
import ContainerSidebar from '../../molecules/ContainerSidebar';
import { ContainerAction } from '../../../api/dtos/update-container';
import useContainerStats from '../../../hooks/use-container-stats';
import { containerQuery, useContainerByIdQuery } from '../../../hooks/queries';
import useConfirm from '@/shared/presentation/hooks/use-confirm';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';
import Container from '@/shared/presentation/components/Container';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import type { EnvVariable } from '@/modules/container/api/entities/env-variable';
import type { PortMapping } from '@/modules/container/api/entities/port-mapping';
import type { ContainerDetailsContext } from '../../../hooks/use-container-details-context';
import './ContainerDetailsLayout.css';

interface ContainerDetailsRouteParams extends Record<string, string | undefined> {
    id: string;
};

const ContainerDetailsLayout = () => {
    const { id } = useParams<ContainerDetailsRouteParams>();
    const navigate = useNavigate();
    const { confirm } = useConfirm();

    const updateContainerMutation = containerQuery.useUpdateMutation();
    const deleteContainerMutation = containerQuery.useDeleteMutation();

    const { data: container, isLoading, isError, error } = useContainerByIdQuery(id!, {
        enabled: !!id
    });

    const actionLoading = updateContainerMutation.isPending || deleteContainerMutation.isPending;
    const { accessDenied, checkAccessDeniedError } = useAccessDenied();

    const isRunning = container?.status === 'running';

    const stats = useContainerStats({
        containerId: id,
        isRunning: !!isRunning
    });

    if(isError){
        if(!checkAccessDeniedError(error)){
            const message = error instanceof Error ? error.message : 'Failed to load container';
            sileo.error({ title: message });
        }
    }

    const handleAction = async (action: ContainerAction | 'delete') => {
        if(!container || !id) return;

        try{
            if(action === 'delete'){
                const isConfirmed = await confirm({
                    title: 'Delete this container?',
                    description: 'This action cannot be undone.',
                    confirmText: 'Delete'
                });
                if(!isConfirmed) return;
                await showPromise(
                    deleteContainerMutation.mutateAsync(id),
                    {
                        loading: { title: 'Deleting container...' },
                        success: { title: 'Container deleted' },
                        error: { title: 'Failed to delete container' }
                    }
                );
                navigate('/dashboard/containers');
                return;
            }

            await showPromise(
                updateContainerMutation.mutateAsync({ id, params: { action } }),
                {
                    loading: { title: `${action.charAt(0).toUpperCase() + action.slice(1)}ing container...` },
                    success: { title: `Container ${action}ed successfully` },
                    error: { title: `Failed to ${action} container` }
                }
            );
        }catch{
            // Error handled by showPromise
        }
    };

    const handleUpdateEnv = async (env: EnvVariable[]) => {
        if(!id) return;
        await showPromise(
            updateContainerMutation.mutateAsync({ id, params: { env } }),
            {
                loading: { title: 'Updating environment variables...' },
                success: { title: 'Environment variables updated' },
                error: { title: 'Failed to update environment variables' }
            }
        );
    };

    const handleUpdatePorts = async (ports: PortMapping[]) => {
        if(!id) return;
        await showPromise(
            updateContainerMutation.mutateAsync({ id, params: { ports } }),
            {
                loading: { title: 'Updating port bindings...' },
                success: { title: 'Port bindings updated - container will be recreated' },
                error: { title: 'Failed to update ports' }
            }
        );
    };

    if(isLoading && !container){
        return <ContainerDetailsSkeleton />;
    }

    if(accessDenied) return <AccessDenied />;

    if(!container) return null;

    const outletContext: ContainerDetailsContext = {
        container,
        stats,
        isRunning: !!isRunning,
        onUpdateEnv: handleUpdateEnv,
        onUpdatePorts: handleUpdatePorts
    };

    return (
        <Container className='container-details-layout d-flex overflow-hidden'>
            <ContainerSidebar
                container={container}
                onBack={() => navigate('/dashboard/containers')}
                onAction={handleAction}
                actionLoading={actionLoading}
            />

            <Container className='container-details-content-area y-auto flex-1'>
                <Outlet context={outletContext} />
            </Container>
        </Container>
    );
};

export default ContainerDetailsLayout;
