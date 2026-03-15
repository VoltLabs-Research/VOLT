import { ReactFlowProvider } from '@xyflow/react';
import PluginBuilder from '@/modules/plugin/components/plugin/organisms/PluginBuilder';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import useLoadPlugin from '@/modules/plugin/hooks/plugin/use-load-plugin';
import UserMenuPopover from '@/modules/auth/components/molecules/UserMenuPopover';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import Loader from '@/shared/presentation/components/Loader';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import Container from '@/shared/presentation/components/Container';
import useConfirm from '@/shared/presentation/hooks/use-confirm';
import { useCallback, useEffect, useState } from 'react';
import { useBlocker, useNavigate } from 'react-router-dom';

const pluginBuilderUserMenu = (
    handleSettingsClick: () => void,
    handleSignOut: () => Promise<void>,
    isSigningOut: boolean
) => {
    return (
        <Container className='editor-sidebar-user-avatar-wrapper p-1-5'>
            <UserMenuPopover
                onSettingsClick={handleSettingsClick}
                onSignOut={handleSignOut}
                isSigningOut={isSigningOut}
            />
        </Container>
    );
};

const PluginBuilderPage = () => {
    const navigate = useNavigate();
    const { searchParams } = useSearchParamsState();
    const pluginId = searchParams.get('id') ?? undefined;

    const clearWorkflow = usePluginBuilderStore((state) => state.clearWorkflow);
    const isDirty = usePluginBuilderStore((state) => state.isDirty);
    const { isLoading, accessDenied, accessDeniedMessage } = useLoadPlugin(pluginId);
    const signOut = useAuthStore((state) => state.signOut);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const { confirm } = useConfirm();
    const navigationBlocker = useBlocker(isDirty);

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
        if (navigationBlocker.state !== 'blocked') {
            return;
        }

        const confirmNavigation = async () => {
            const isConfirmed = await confirm({
                title: 'Leave with unsaved changes?',
                description: 'Your plugin has unsaved changes. Save before leaving to avoid losing your edits.',
                confirmText: 'Leave',
                cancelText: 'Stay'
            });

            if (isConfirmed) {
                navigationBlocker.proceed();
                return;
            }

            navigationBlocker.reset();
        };

        confirmNavigation().catch(() => {
            navigationBlocker.reset();
        });
    }, [confirm, navigationBlocker]);

    const handleBack = useCallback(() => {
        navigate(-1);
    }, [navigate]);

    const bottomSidebarContent = pluginBuilderUserMenu(handleSettingsClick, handleSignOut, isSigningOut);

    useEffect(() => {
        if (!pluginId) {
            clearWorkflow();
        }
    }, [pluginId, clearWorkflow]);

    useEffect(() => {
        return () => {
            if (navigationBlocker.state === 'blocked') {
                navigationBlocker.reset();
            }

            clearWorkflow();
        };
    }, [clearWorkflow, navigationBlocker]);

    if (accessDenied) {
        return <AccessDenied description={accessDeniedMessage} />;
    }

    if (isLoading) {
        return <Loader scale={0.8} />;
    }

    return (
        <ReactFlowProvider>
            <PluginBuilder
                onBack={handleBack}
                bottomSidebarContent={bottomSidebarContent}
            />
        </ReactFlowProvider>
    );
};

export default PluginBuilderPage;
