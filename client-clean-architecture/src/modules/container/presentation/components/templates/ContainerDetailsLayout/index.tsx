import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import useContainerUseCases from '../../../hooks/use-container-use-cases';
import useContainerStats from '../../../hooks/use-container-stats';
import useToast from '@/shared/presentation/hooks/use-toast';
import { confirm } from '@/shared/presentation/hooks/use-confirm';
import Container from '@/shared/presentation/components/Container';
import ContainerSidebar from '../../molecules/ContainerSidebar';
import ContainerDetailsSkeleton from '../../atoms/ContainerDetailsSkeleton';
import type { Container as ContainerEntity, EnvVariable, PortMapping } from '@/modules/container/domain/entities';
import type { ContainerDetailsContext } from '../../../hooks/use-container-details-context';
import './ContainerDetailsLayout.css';

const ContainerDetailsLayout = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();
    const { containerRepository } = useContainerUseCases();

    const [container, setContainer] = useState<ContainerEntity | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

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
            showError(error?.message || 'Failed to load container');
        }finally{
            setIsLoading(false);
        }
    }, [id, containerRepository, showError]);

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
                await containerRepository.delete(id);
                showSuccess('Container deleted');
                navigate('/dashboard/containers');
                return;
            }

            const updated = await containerRepository.update(id, { action });
            setContainer(updated);
            showSuccess(`Container ${action}ed successfully`);
        }catch(error: any){
            showError(error?.message || `Failed to ${action} container`);
        }finally{
            setActionLoading(false);
        }
    };

    const handleUpdateEnv = async (env: EnvVariable[]) => {
        if(!id) return;
        try{
            const updated = await containerRepository.update(id, { env });
            setContainer(updated);
            showSuccess('Environment variables updated');
        }catch(error: any){
            showError(error?.message || 'Failed to update environment variables');
        }
    };

    const handleUpdatePorts = async (ports: PortMapping[]) => {
        if(!id) return;
        try{
            const updated = await containerRepository.update(id, { ports });
            setContainer(updated);
            showSuccess('Port bindings updated - container will be recreated');
        }catch(error: any){
            showError(error?.message || 'Failed to update ports');
        }
    };

    if(isLoading && !container){
        return <ContainerDetailsSkeleton />;
    }

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
