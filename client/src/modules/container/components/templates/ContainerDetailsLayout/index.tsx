import { resolveConfiguredRouteTitle } from '@/app/routes/metadata';
import Container from '@/shared/presentation/components/Container';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import { runAction } from '@/shared/presentation/actions/run-action';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import { createPromiseToastOptions } from '@/shared/presentation/toast-options';
import useTip from '@/shared/tips/use-tip';
import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ContainerAction } from '../../../api/dtos/update-container';
import ContainerDetailsSkeleton from '../../atoms/ContainerDetailsSkeleton';
import ContainerSidebar from '../../molecules/ContainerSidebar';
import { containerQuery, useContainerByIdQuery } from '../../../hooks/queries';
import useContainerStats from '../../../hooks/use-container-stats';
import type { EnvVariable } from '@/modules/container/api/entities/env-variable';
import type { PortMapping } from '@/modules/container/api/entities/port-mapping';
import type { ContainerDetailsContext } from '../../../hooks/use-container-details-context';
import './ContainerDetailsLayout.css';

interface ContainerDetailsRouteParams extends Record<string, string | undefined> {
    id: string;
};

const resolveContainerSectionTitle = (pathname: string): string => {
    if (/^\/dashboard\/containers\/[^/]+\/?$/u.test(pathname)) {
        return 'Details';
    }

    const routeTitle = resolveConfiguredRouteTitle(pathname);

    if (!routeTitle || routeTitle === 'Container Details') {
        return 'Details';
    }

    return routeTitle.replace(/^Container\s+/u, '');
};

const ContainerDetailsLayout = () => {
    const { id } = useParams<ContainerDetailsRouteParams>();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const didCollapseSidebar = useRef(false);

    useEffect(() => {
        didCollapseSidebar.current = true;
        window.dispatchEvent(new CustomEvent('volt:request-sidebar-collapse'));

        return () => {
            if (didCollapseSidebar.current) {
                window.dispatchEvent(new CustomEvent('volt:request-sidebar-expand'));
            }
        };
    }, []);

    const updateContainerMutation = containerQuery.useUpdateMutation();
    const deleteContainerMutation = containerQuery.useDeleteMutation();

    const { data: container, isLoading, isError, error } = useContainerByIdQuery(id!, {
        enabled: !!id
    });

    const fallbackSectionTitle = resolveContainerSectionTitle(pathname);
    const fallbackTitle = fallbackSectionTitle === 'Details'
        ? 'Container Details'
        : `Container ${fallbackSectionTitle}`;
    let pageTitle = fallbackTitle;

    if (container?.name) {
        pageTitle = container.name;

        if (fallbackSectionTitle !== 'Details') {
            pageTitle = `${container.name} - ${fallbackSectionTitle}`;
        }
    }

    usePageTitle(pageTitle);

    const actionLoading = updateContainerMutation.isPending || deleteContainerMutation.isPending;
    const { accessDenied, checkAccessDeniedError } = useAccessDenied();

    const isRunning = container?.status === 'running';

    useTip('container-details-tabs', {
        enabled: Boolean(container)
    });

    const stats = useContainerStats({
        containerId: id,
        isRunning: !!isRunning
    });

    useEffect(() => {
        if (!isError) {
            return;
        }

        if (!checkAccessDeniedError(error)) {
            reportError(error, {
                surface: ErrorSurface.Toast,
                fallbackTitle: 'Failed to load container'
            });
        }
    }, [checkAccessDeniedError, error, isError]);

    const handleAction = async (action: ContainerAction | 'delete') => {
        if(!container || !id) return;

        try{
            if(action === 'delete'){
                await runAction({
                    action: () => deleteContainerMutation.mutateAsync(id),
                    confirm: {
                        title: 'Delete this container?',
                        description: 'This action cannot be undone.',
                        confirmText: 'Delete'
                    },
                    toast: createPromiseToastOptions({
                        loading: 'Deleting container...',
                        success: 'Container deleted',
                        error: 'Failed to delete container'
                    }),
                    afterSuccess: () => {
                        navigate('/dashboard/containers');
                    }
                });
                return;
            }

            await runAction({
                action: () => updateContainerMutation.mutateAsync({ id, params: { action } }),
                toast: createPromiseToastOptions({
                    loading: `${action.charAt(0).toUpperCase() + action.slice(1)}ing container...`,
                    success: `Container ${action}ed successfully`,
                    error: `Failed to ${action} container`
                })
            });
        }catch{
            // Error handled by showPromise
        }
    };

    const handleUpdateEnv = async (env: EnvVariable[]) => {
        if(!id) return;
        await runAction({
            action: () => updateContainerMutation.mutateAsync({ id, params: { env } }),
            toast: createPromiseToastOptions({
                loading: 'Updating environment variables...',
                success: 'Environment variables updated',
                error: 'Failed to update environment variables'
            })
        });
    };

    const handleUpdatePorts = async (ports: PortMapping[]) => {
        if(!id) return;
        await runAction({
            action: () => updateContainerMutation.mutateAsync({ id, params: { ports } }),
            toast: createPromiseToastOptions({
                loading: 'Updating port bindings...',
                success: 'Port bindings updated - container will be recreated',
                error: 'Failed to update ports'
            })
        });
    };

    if(isLoading && !container){
        return <ContainerDetailsSkeleton />;
    }

    if(accessDenied) return <AccessDenied />;

    if(!container){
        return (
            <Container className='d-flex flex-center h-max'>
                <RecoveryState
                    title='Container not found'
                    description={isError && error instanceof Error ? error.message : 'The requested container could not be loaded.'}
                    tone={RecoveryStateTone.Error}
                    retryLabel='Go back'
                    onRetry={() => navigate('/dashboard/containers')}
                />
            </Container>
        );
    }

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

            <Container className='container-details-content-area y-auto flex-1 d-flex column'>
                <Outlet context={outletContext} />
            </Container>
        </Container>
    );
};

export default ContainerDetailsLayout;
