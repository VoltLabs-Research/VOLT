import { resolveConfiguredRouteTitle } from '@/app/routes/metadata';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import { runAction } from '@/shared/presentation/actions/run-action';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import { createPromiseToastOptions } from '@/shared/presentation/toast-options';
import useTip from '@/shared/tips/use-tip';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ContainerAction } from '../../api/dtos/update-container';
import ContainerDetailsSkeleton from '../ContainerDetailsSkeleton';
import ContainerDetailsHeader from '../ContainerDetailsHeader';
import { containerQuery, useContainerByIdQuery } from '../../hooks/queries';
import useContainerStats from '../../hooks/use-container-stats';
import type { EnvVariable } from '@/modules/container/api/entities/env-variable';
import type { PortMapping } from '@/modules/container/api/entities/port-mapping';
import type { ContainerDetailsContext } from '../../hooks/use-container-details-context';
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
    const [headerActions, setHeaderActions] = useState<ReactNode>(null);

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

    const handleAction = useCallback(async (action: ContainerAction | 'delete') => {
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
    }, [container, id, deleteContainerMutation, updateContainerMutation, navigate]);

    const handleUpdateEnv = useCallback(async (env: EnvVariable[]) => {
        if(!id) return;
        await runAction({
            action: () => updateContainerMutation.mutateAsync({ id, params: { env } }),
            toast: createPromiseToastOptions({
                loading: 'Updating environment variables...',
                success: 'Environment variables updated',
                error: 'Failed to update environment variables'
            })
        });
    }, [id, updateContainerMutation]);

    const handleUpdatePorts = useCallback(async (ports: PortMapping[]) => {
        if(!id) return;
        await runAction({
            action: () => updateContainerMutation.mutateAsync({ id, params: { ports } }),
            toast: createPromiseToastOptions({
                loading: 'Updating port bindings...',
                success: 'Port bindings updated - container will be recreated',
                error: 'Failed to update ports'
            })
        });
    }, [id, updateContainerMutation]);

    const handleBack = useCallback(() => navigate('/dashboard/containers'), [navigate]);

    const outletContext = useMemo<ContainerDetailsContext | null>(() => {
        if (!container) return null;
        return {
            container,
            stats,
            isRunning: !!isRunning,
            onUpdateEnv: handleUpdateEnv,
            onUpdatePorts: handleUpdatePorts,
            setHeaderActions
        };
    }, [container, stats, isRunning, handleUpdateEnv, handleUpdatePorts]);

    if(isLoading && !container){
        return <ContainerDetailsSkeleton />;
    }

    if(accessDenied) return <AccessDenied />;

    if(!container || !outletContext){
        return (
            <div className='volt-container d-flex flex-center h-max'>
                <RecoveryState
                    title='Container not found'
                    description={isError && error instanceof Error ? error.message : 'The requested container could not be loaded.'}
                    tone={RecoveryStateTone.Error}
                    retryLabel='Go back'
                    onRetry={() => navigate('/dashboard/containers')}
                />
            </div>
        );
    }

    return (
        <div className='volt-container container-details-layout d-flex column'>
            <ContainerDetailsHeader
                container={container}
                onBack={handleBack}
                onAction={handleAction}
                actionLoading={actionLoading}
                contextualActions={headerActions}
            />

            <div className='volt-container container-details-content-area flex-1 d-flex column'>
                <Outlet context={outletContext} />
            </div>
        </div>
    );
};

export default ContainerDetailsLayout;
