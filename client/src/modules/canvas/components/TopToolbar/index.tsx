import CanvasPluginSearch from '../CanvasPluginSearch';
import TrajectorySharePanelPopover from '../TrajectorySharePanelPopover';
import WorkspacePeerAvatars from '../WorkspacePeerAvatars';

import EditableTrajectoryName from '@/modules/trajectory/components/EditableTrajectoryName';
import WindowControls from '@/shared/ui/components/WindowControls';
import ThemeToggleButton from '@/shared/ui/components/ThemeToggleButton';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useSingleTenant } from '@/modules/system/hooks/use-single-tenant';
import { memo, useCallback, useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button, cn } from '@heroui/react';

import type { WorkspacePresenceUser } from '@/modules/canvas/collaboration/use-canvas-workspace';
import type { ReactNode } from 'react';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import { useNavigate } from 'react-router-dom';

interface TopToolbarShareInfo {
    trajectoryId: string;
    isPublic: boolean;
    canManageVisibility: boolean;
}

interface TopToolbarProps {
    trajectory?: Trajectory | null;
    localGlbMode?: boolean;
    canMutateCanvas?: boolean;
    workspacePeers?: WorkspacePresenceUser[];
    workspaceActiveOwnerId?: string;
    onSelectWorkspacePeer?: (peerId: string) => void;
    share?: TopToolbarShareInfo;
    contextualActions?: ReactNode;
}

const TopToolbar = ({
    trajectory,
    localGlbMode = false,
    canMutateCanvas = true,
    workspacePeers,
    workspaceActiveOwnerId,
    onSelectWorkspacePeer,
    share,
    contextualActions
}: TopToolbarProps) => {
    const navigate = useNavigate();
    const user = useCurrentUser();

    const handleBack = useCallback(() => navigate('/dashboard'), [navigate]);

    const selfPresence = useMemo<WorkspacePresenceUser | undefined>(() => {
        if (!user) return undefined;
        return {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            avatar: user.avatar,
            isAnonymous: false
        };
    }, [user]);

    const singleTenant = useSingleTenant();
    const canShowPeers = !singleTenant && Boolean(onSelectWorkspacePeer && (workspacePeers?.length ?? 0) > 0);

    return (
        <header className='absolute left-0 right-0 top-0 z-[4] flex select-none items-stretch bg-chrome px-4 min-h-[var(--canvas-header-height,55px)] max-md:h-[var(--canvas-header-height,40px)] max-md:min-h-[var(--canvas-header-height,40px)] max-md:px-3 canvas-top-toolbar'>
            <div className='grid h-[var(--canvas-header-height,55px)] w-full grid-cols-[minmax(0,1fr)_minmax(0,420px)_minmax(0,1fr)] items-center gap-2 max-md:h-[var(--canvas-header-height,40px)] max-md:grid-cols-[auto_minmax(0,1fr)]'>
                <div className='flex min-w-0 flex-row flex-nowrap items-center overflow-hidden'>
                    <Button
                        variant='ghost'
                        size='sm'
                        isIconOnly
                        aria-label='Back to dashboard'
                        onPress={handleBack}
                    >
                        <ChevronLeft size={16} aria-hidden='true' />
                    </Button>
                    {trajectory && (
                        <div
                            className='flex min-w-0 max-w-[220px] flex-row items-center justify-start px-2'
                            title={trajectory.name}
                        >
                            <EditableTrajectoryName
                                trajectoryId={trajectory._id}
                                name={trajectory.name}
                                className='overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-6 text-foreground'
                            />
                        </div>
                    )}
                </div>

                <div className='flex min-w-0 flex-row items-center justify-center'>
                    {canMutateCanvas && <CanvasPluginSearch />}
                </div>

                <div className={cn('flex min-w-0 flex-row items-center justify-end gap-1', 'max-md:hidden')}>
                    {contextualActions}
                    <ThemeToggleButton />
                    {canShowPeers && onSelectWorkspacePeer && (
                        <WorkspacePeerAvatars
                            peers={workspacePeers ?? []}
                            self={localGlbMode ? undefined : selfPresence}
                            activeOwnerId={workspaceActiveOwnerId}
                            onSelectPeer={onSelectWorkspacePeer}
                        />
                    )}
                    {share && user && (
                        <TrajectorySharePanelPopover
                            trajectoryId={share.trajectoryId}
                            isPublic={share.isPublic}
                            canManageVisibility={share.canManageVisibility}
                        />
                    )}
                    <WindowControls />
                </div>
            </div>
        </header>
    );
};

export default memo(TopToolbar);
