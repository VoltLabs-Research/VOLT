import { resolveConfiguredRouteTitle } from '@/app/routes/metadata';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import { runAction } from '@/shared/presentation/actions/run-action';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import { usePrefersReducedMotion } from '@voltstack/bravais';
import { createPromiseToastOptions } from '@/shared/presentation/utilities/toast-options';
import useTip from '@/shared/tips/use-tip';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Box, Stack, Row, Skeleton } from '@voltstack/bravais';
import { Outlet, useLocation, useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ContainerAction } from '../../api/service';
import ContainerDetailsHeader from '../ContainerDetailsHeader';
import { containerQuery, useContainerByIdQuery } from '../../hooks/queries';
import useContainerStats from '../../hooks/use-container-stats';
import type { EnvVariable } from '@/modules/container/api/entities/env-variable';
import type { PortMapping } from '@/modules/container/api/entities/port-mapping';
import type { ContainerDetailsContext } from '../../hooks/use-container-details-context';
import './ContainerDetailsLayout.css';
interface ContainerDetailsRouteParams extends Record<string, string | undefined> {
    id: string;
}

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
    const prefersReducedMotion = usePrefersReducedMotion();
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
        return (
            <Stack className='container-details-layout'>
                <Stack className='container-details-header'>
                    <Skeleton variant='text' width={60} height={24} style={{ marginBottom: 8 }} />
                    <Row justify='between' align='start' style={{ gap: '1rem' }}>
                        <Stack gap='05'>
                            <Skeleton variant='text' width={220} height={28} />
                            <Skeleton variant='text' width={320} height={18} />
                        </Stack>
                        <Row gap='05'>
                            <Skeleton variant='rounded' width={96} height={32} />
                            <Skeleton variant='rounded' width={96} height={32} />
                        </Row>
                    </Row>
                    <Box className='container-details-header-tabs-row'>
                        <Skeleton variant='rounded' width={320} height={30} />
                    </Box>
                </Stack>
                <Stack className='container-details-content-area' flex='1' p='1-5' gap='1-5'>
                    <Row gap='2'>
                        <Skeleton variant='rounded' width='33%' height={140} />
                        <Skeleton variant='rounded' width='33%' height={140} />
                        <Skeleton variant='rounded' width='33%' height={140} />
                    </Row>
                    <Skeleton variant='rounded' width='100%' height={240} />
                </Stack>
            </Stack>
        );
    }

    if(accessDenied) return <AccessDenied />;

    if(!container || !outletContext){
        return (
            <Box className='flex-center' display='flex' height='max'>
                <RecoveryState
                    title='Container not found'
                    description={isError && error instanceof Error ? error.message : 'The requested container could not be loaded.'}
                    tone={RecoveryStateTone.Error}
                    retryLabel='Go back'
                    onRetry={() => navigate('/dashboard/containers')}
                />
            </Box>
        );
    }

    return (
        <Stack className='container-details-layout'>
            <ContainerDetailsHeader
                container={container}
                onBack={handleBack}
                onAction={handleAction}
                actionLoading={actionLoading}
                contextualActions={headerActions}
            />

            <Stack className='container-details-content-area' flex='1'>
                <motion.div
                    key={pathname}
                    initial={prefersReducedMotion ? false : { opacity: 0 }}
                    animate={prefersReducedMotion ? undefined : { opacity: 1 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                    style={{ height: '100%' }}
                >
                    <Outlet context={outletContext} />
                </motion.div>
            </Stack>
        </Stack>
    );
};

export default ContainerDetailsLayout;
