import { lazy, Suspense, useEffect } from 'react';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import useLoadPlugin from '@/modules/plugin/hooks/plugin/use-load-plugin';
import UserMenuPopover from '@/modules/auth/components/UserMenuPopover';
import useUserSessionActions from '@/modules/auth/hooks/use-user-session-actions';
import { Spinner } from '@heroui/react';
import AccessDenied from '@/shared/ui/components/AccessDenied';
import { useSearchParams, useNavigate } from 'react-router-dom';
const PluginBuilder = lazy(() => import('@/modules/plugin/components/plugin/PluginBuilder'));
const ReactFlowProvider = lazy(() => import('@xyflow/react').then((module) => ({ default: module.ReactFlowProvider })));

/*
 * bravais's `Loader` defaulted to `isFixed`, i.e. `fixed inset-0` plus centring, and
 * `scale` sized its 12-dot visual. HeroUI's `Spinner` has a size scale instead, so
 * `scale={0.8}` becomes `size='lg'` — the chrome differs, the role does not. Both
 * loaders here fill the viewport, so the fixed layer is written out explicitly.
 */
const FULL_SCREEN_LOADER_CLASS = 'fixed inset-0 flex flex-row items-center justify-center';

const BuilderSkeleton = () => (
    <div className='flex w-screen h-dvh flex-row items-center justify-center'>
        <Spinner size='lg' />
    </div>
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
        <div className='p-6'>
            <UserMenuPopover
                onSettingsClick={handleSettingsClick}
                onSignOut={handleSignOut}
                isSigningOut={isSigningOut}
            />
        </div>
    );

    if (accessDenied) {
        return <AccessDenied description={accessDeniedMessage} />;
    }

    if (isLoading) {
        return (
            <div className={FULL_SCREEN_LOADER_CLASS}>
                <Spinner size='lg' />
            </div>
        );
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
