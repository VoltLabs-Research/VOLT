import { lazy, Suspense, useCallback, useEffect, useMemo } from 'react';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import useLoadPlugin from '@/modules/plugin/hooks/plugin/use-load-plugin';
import UserMenuPopover from '@/modules/auth/components/UserMenuPopover';
import useUserSessionActions from '@/modules/auth/hooks/use-user-session-actions';
import { Box, Loader } from '@voltstack/bravais';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import { useSearchParams, useNavigate } from 'react-router-dom';
// Why: ReactFlow (~200 KB gz), Monaco (~1 MB gz), and the builder/canvas graph
// only load when a user opens `/plugins/builder`. The dashboard route chunk
// stays lean for first-paint workflows that never touch the builder.
const PluginBuilder = lazy(() => import('@/modules/plugin/components/plugin/PluginBuilder'));
const ReactFlowProvider = lazy(() => import('@xyflow/react').then((module) => ({ default: module.ReactFlowProvider })));

const BuilderSkeleton = () => (
    <Box display='flex' align='center' className='justify-center wh-max vh-max'>
        <Loader scale={0.8} />
    </Box>
);

const PluginBuilderPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const pluginId = searchParams.get('id') ?? undefined;

    const clearWorkflow = usePluginBuilderStore((state) => state.clearWorkflow);
    const { isLoading, accessDenied, accessDeniedMessage } = useLoadPlugin(pluginId);
    const { handleSettingsClick, handleSignOut, isSigningOut } = useUserSessionActions();

    const handleBack = useCallback(() => navigate(-1), [navigate]);

    useEffect(() => {
        if (!pluginId) {
            clearWorkflow();
        }
    }, [pluginId, clearWorkflow]);

    useEffect(() => {
        return () => {
            clearWorkflow();
        };
    }, [clearWorkflow]);

    const bottomSidebarContent = useMemo(() => (
        <Box p='1-5' className='editor-sidebar-user-avatar-wrapper'>
            <UserMenuPopover
                onSettingsClick={handleSettingsClick}
                onSignOut={handleSignOut}
                isSigningOut={isSigningOut}
            />
        </Box>
    ), [handleSettingsClick, handleSignOut, isSigningOut]);

    if (accessDenied) {
        return <AccessDenied description={accessDeniedMessage} />;
    }

    if (isLoading) {
        return <Loader scale={0.8} />;
    }

    return (
        <Suspense fallback={<BuilderSkeleton />}>
            <ReactFlowProvider>
                <PluginBuilder
                    onBack={handleBack}
                    bottomSidebarContent={bottomSidebarContent}
                />
            </ReactFlowProvider>
        </Suspense>
    );
};

export default PluginBuilderPage;
