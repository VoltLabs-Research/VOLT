import { useCallback, useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import PluginBuilder from '@/modules/plugin/components/plugin/organisms/PluginBuilder';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import useLoadPlugin from '@/modules/plugin/hooks/plugin/use-load-plugin';
import UserMenuPopover from '@/modules/auth/components/molecules/UserMenuPopover';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import Loader from '@/shared/presentation/components/Loader';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import Container from '@/shared/presentation/components/Container';
import { useNavigate } from 'react-router';
import { useSearchParams } from 'react-router-dom';

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

    if (accessDenied) {
        return <AccessDenied description={accessDeniedMessage} />;
    }

    if (isLoading) {
        return <Loader scale={0.8} />;
    }

    return (
        <ReactFlowProvider>
            <PluginBuilder
                onBack={() => navigate(-1)}
                bottomSidebarContent={(
                    <Container className='editor-sidebar-user-avatar-wrapper p-1-5'>
                        <UserMenuPopover
                            onSettingsClick={handleSettingsClick}
                            onSignOut={handleSignOut}
                            isSigningOut={isSigningOut}
                        />
                    </Container>
                )}
            />
        </ReactFlowProvider>
    );
};

export default PluginBuilderPage;
