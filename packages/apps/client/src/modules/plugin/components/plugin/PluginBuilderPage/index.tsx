import { Skeleton } from '@heroui/react';
import { lazy, Suspense, useEffect } from 'react';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import useLoadPlugin from './use-load-plugin';
import UserMenuPopover from '@/modules/auth/components/UserMenuPopover';
import useUserSessionActions from '@/modules/auth/hooks/use-user-session-actions';
import { useSingleTenant } from '@/modules/system/hooks/use-single-tenant';

import AccessDenied from '@/shared/ui/components/AccessDenied';
import { useSearchParams, useNavigate } from 'react-router-dom';
const PluginBuilder = lazy(() => import('@/modules/plugin/components/plugin/PluginBuilder'));
const ReactFlowProvider = lazy(() => import('@xyflow/react').then((module) => ({ default: module.ReactFlowProvider })));

// The palette's nodes while the builder loads, at the widths of a few labels and descriptions.
const PALETTE_SKELETON_ROWS = [
    ['38%', '72%'], ['30%', '64%'], ['44%', '78%'], ['34%', '58%'], ['40%', '70%'], ['28%', '62%']
];

// The builder as it opens: its sidebar (Sidebar, 380px at left-2 inset-y-2) with the back button and the
// plugin name over the palette, beside the empty canvas.
const BuilderSkeleton = () => (
    <div className='fixed inset-0' role='status' aria-label='Opening the plugin builder'>
        <div className='absolute inset-y-2 left-2 w-[380px] max-[768px]:w-[min(460px,calc(100vw-1rem))]'>
            <div className='glass-surface flex h-full w-full flex-col overflow-hidden rounded-2xl border-0 bg-dashboard-surface shadow-[var(--overlay-shadow)]'>
                <div className='flex items-center gap-1.5 pt-3.5 pr-3.5 pb-2 pl-2.5'>
                    <Skeleton className='size-9 shrink-0 rounded-full' />
                    <Skeleton className='h-4 w-36 rounded-md' />
                </div>
                <div className='flex flex-col gap-0.5 px-2.5 pt-2 pb-4'>
                    {PALETTE_SKELETON_ROWS.map(([labelWidth, descriptionWidth], index) => (
                        <div className='flex flex-col gap-0.5 px-4 py-3' key={index}>
                            <span className='flex h-6 items-center'>
                                <Skeleton className='h-3.5 rounded-md' style={{ width: labelWidth }} />
                            </span>
                            <span className='flex h-5 items-center'>
                                <Skeleton className='h-2.5 rounded-md' style={{ width: descriptionWidth }} />
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
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

    const singleTenant = useSingleTenant();
    const bottomSidebarContent = singleTenant ? undefined : ({ collapsed }: { collapsed: boolean }) => (
        <div className={collapsed ? 'flex justify-center pt-1.5 pb-2.5' : 'px-2.5 pt-1.5 pb-2.5'}>
            <UserMenuPopover
                onSettingsClick={handleSettingsClick}
                onSignOut={handleSignOut}
                isSigningOut={isSigningOut}
                collapsed={collapsed}
            />
        </div>
    );

    if (accessDenied) {
        return <AccessDenied description={accessDeniedMessage} />;
    }

    if (isLoading) {
        return <BuilderSkeleton />;
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
