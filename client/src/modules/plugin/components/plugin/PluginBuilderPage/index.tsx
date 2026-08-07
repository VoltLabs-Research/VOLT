import { lazy, Suspense, useEffect } from 'react';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import useLoadPlugin from '@/modules/plugin/hooks/plugin/use-load-plugin';
import UserMenuPopover from '@/modules/auth/components/UserMenuPopover';
import useUserSessionActions from '@/modules/auth/hooks/use-user-session-actions';
import { Box, Loader } from '@voltstack/bravais';
import AccessDenied from '@/shared/ui/components/AccessDenied';
import { useSearchParams, useNavigate } from 'react-router-dom';
const PluginBuilder = lazy(() => import('@/modules/plugin/components/plugin/PluginBuilder'));
const ReactFlowProvider = lazy(() => import('@xyflow/react').then((module) => ({ default: module.ReactFlowProvider })));

const BuilderSkeleton = () => (
    <Box display='flex' align='center' className='justify-center w-screen h-dvh'>
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

    const handleBack = () => navigate(-1);

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

    const bottomSidebarContent = (
        <Box p='1-5' className='editor-sidebar-user-avatar-wrapper'>
            <UserMenuPopover
                onSettingsClick={handleSettingsClick}
                onSignOut={handleSignOut}
                isSigningOut={isSigningOut}
            />
        </Box>
    );

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
