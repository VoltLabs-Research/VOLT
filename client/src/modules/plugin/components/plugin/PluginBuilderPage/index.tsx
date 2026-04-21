import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import useLoadPlugin from '@/modules/plugin/hooks/plugin/use-load-plugin';
import UserMenuPopover from '@/modules/auth/components/UserMenuPopover';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import Loader from '@/shared/presentation/components/Loader';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import { useNavigate } from 'react-router';
import { useSearchParams } from 'react-router-dom';

// Why: ReactFlow (~200 KB gz), Monaco (~1 MB gz), and the builder/canvas graph
// only load when a user opens `/plugins/builder`. The dashboard route chunk
// stays lean for first-paint workflows that never touch the builder.
const PluginBuilder = lazy(() => import('@/modules/plugin/components/plugin/PluginBuilder'));
const ReactFlowProvider = lazy(() => import('@xyflow/react').then((module) => ({ default: module.ReactFlowProvider })));

const BuilderSkeleton = () => (
    <div className='volt-container d-flex items-center justify-center wh-max vh-max'>
        <Loader scale={0.8} />
    </div>
);

const PluginBuilderPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const pluginId = searchParams.get('id') ?? undefined;

    const clearWorkflow = usePluginBuilderStore((state) => state.clearWorkflow);
    const { isLoading, accessDenied, accessDeniedMessage } = useLoadPlugin(pluginId);
    const signOut = useAuthStore((state) => state.signOut);
    const [isSigningOut, setIsSigningOut] = useState(false);

    const handleSignOut = useCallback(async () => {
        try {
            setIsSigningOut(true);
            await signOut();
        } finally {
            setIsSigningOut(false);
        }
    }, [signOut]);

    const handleSettingsClick = useCallback(() => {
        navigate('/dashboard/settings/general');
    }, [navigate]);

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
        <div className='volt-container editor-sidebar-user-avatar-wrapper p-1-5'>
            <UserMenuPopover
                onSettingsClick={handleSettingsClick}
                onSignOut={handleSignOut}
                isSigningOut={isSigningOut}
            />
        </div>
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
