import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import useContainerUseCases from '../../../hooks/use-container-repository';
import useContainerStats from '../../../hooks/use-container-stats';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';
import { confirm } from '@/shared/presentation/hooks/use-confirm';
import Container from '@/shared/presentation/components/Container';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import ContainerSidebar from '../../molecules/ContainerSidebar';
import ContainerDetailsSkeleton from '../../atoms/ContainerDetailsSkeleton';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import type { Container as ContainerEntity, EnvVariable, PortMapping } from '@/modules/container/domain/entities';
import type { ContainerDetailsContext } from '../../../hooks/use-container-details-context';
import './ContainerDetailsLayout.css';

const ContainerDetailsLayout = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { containerRepository } = useContainerUseCases();

    const [container, setContainer] = useState<ContainerEntity | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const { accessDenied, checkRBACError } = useAccessDenied();

    const isRunning = container?.status === 'running';

    const fetchStats = useCallback(async (containerId: string) => {
        return await containerRepository.getStats(containerId);
    }, [containerRepository]);

    const stats = useContainerStats({
        containerId: id,
        isRunning: !!isRunning,
        fetchStats
    });

    const fetchContainer = useCallback(async () => {
        if(!id) return;
        setIsLoading(true);
        try{
            const data = await containerRepository.getById(id);
            setContainer(data);
        }catch(error: any){
            if(!checkRBACError(error)){
                sileo.error({ title: error?.message || 'Failed to load container' });
            }
        }finally{
            setIsLoading(false);
        }
    }, [id, containerRepository]);

    useEffect(() => {
        fetchContainer();
    }, [fetchContainer]);

    const handleAction = async (action: 'start' | 'stop' | 'restart' | 'delete') => {
        if(!container || !id) return;
        setActionLoading(true);

        try{
            if(action === 'delete'){
                const isConfirmed = confirm('Are you sure you want to delete this container?');
                if(!isConfirmed){
                    setActionLoading(false);
                    return;
                }
                await showPromise(
                    containerRepository.delete(id),
                    {
                        loading: { title: 'Deleting container...' },
                        success: { title: 'Container deleted' },
                        error: { title: 'Failed to delete container' }
                    }
                );
                navigate('/dashboard/containers');
                return;
            }

            const updated = await showPromise(
                containerRepository.update(id, { action }),
                {
                    loading: { title: `${action.charAt(0).toUpperCase() + action.slice(1)}ing container...` },
                    success: { title: `Container ${action}ed successfully` },
                    error: { title: `Failed to ${action} container` }
                }
            );
            setContainer(updated);
        }finally{
            setActionLoading(false);
        }
    };

    const handleUpdateEnv = async (env: EnvVariable[]) => {
        if(!id) return;
        const updated = await showPromise(
            containerRepository.update(id, { env }),
            {
                loading: { title: 'Updating environment variables...' },
                success: { title: 'Environment variables updated' },
                error: { title: 'Failed to update environment variables' }
            }
        );
        setContainer(updated);
    };

    const handleUpdatePorts = async (ports: PortMapping[]) => {
        if(!id) return;
        const updated = await showPromise(
            containerRepository.update(id, { ports }),
            {
                loading: { title: 'Updating port bindings...' },
                success: { title: 'Port bindings updated - container will be recreated' },
                error: { title: 'Failed to update ports' }
            }
        );
        setContainer(updated);
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
