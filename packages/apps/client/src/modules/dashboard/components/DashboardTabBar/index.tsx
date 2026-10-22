import { sidebarPanelFor, TRAJECTORIES_LIST_PATH } from '@/modules/dashboard/utils/sidebar-panels';
import useDefaultSettingsPath from '@/modules/dashboard/hooks/use-default-settings-path';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import useTrajectoryFilePicker from '@/modules/trajectory/hooks/trajectory/use-trajectory-file-picker';
import useFolderSearchParam from '@/shared/ui/hooks/use-folder-search-param';
import { cn } from '@heroui/react';
import { Box, LayoutGrid, Plus, Settings, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

const WELL_CLASS = 'flex size-10 items-center justify-center rounded-full transition-colors duration-150';

interface TabProps {
    label: string;
    icon: LucideIcon;
    to: string;
    isActive: boolean;
}

const Tab = ({ label, icon: Icon, to, isActive }: TabProps) => (
    <li className='flex min-w-0 flex-1'>
        <Link
            to={to}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
            className={cn('flex flex-1 items-center justify-center', isActive ? 'text-foreground' : 'text-muted/70')}
        >
            <span className={cn(WELL_CLASS, isActive && 'bg-foreground/7')}>
                <Icon className='size-5.5' aria-hidden='true' />
            </span>
        </Link>
    </li>
);

// The listings whose ?folderId is a trajectory folder; others (whiteboards) share the param.
const TRAJECTORY_FOLDER_PATHS = new Set(['/dashboard', '/dashboard/trajectories/list']);

// Below 64rem the main destinations sit at the bottom, within reach; the drawer keeps the full nav.
const DashboardTabBar = () => {
    const { pathname } = useLocation();
    const panel = sidebarPanelFor(pathname);
    const settingsPath = useDefaultSettingsPath();
    const { canAccess } = useTeamPermissions();
    const { currentFolderId } = useFolderSearchParam();
    const uploadFolderId = TRAJECTORY_FOLDER_PATHS.has(pathname) ? currentFolderId : null;
    const { fileInputRef, handlePickerChange, openFilePicker, isUploading } = useTrajectoryFilePicker(undefined, uploadFolderId);

    const canUpload = canAccess(['trajectory:create']);

    return (
        <nav
            aria-label='Tabs'
            className='shrink-0 border-t border-foreground/6 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] lg:hidden'
        >
            <ul className='flex h-14 items-stretch'>
                <Tab label='Dashboard' icon={LayoutGrid} to='/dashboard' isActive={pathname === '/dashboard'} />

                {canAccess(['trajectory:read']) && (
                    <Tab label='Trajectories' icon={Box} to={TRAJECTORIES_LIST_PATH} isActive={panel === 'trajectories'} />
                )}

                {canUpload && (
                    <li className='flex min-w-0 flex-1'>
                        <input ref={fileInputRef} type='file' multiple hidden onChange={handlePickerChange} />
                        <button
                            type='button'
                            aria-label='Upload trajectory'
                            className='flex flex-1 cursor-pointer items-center justify-center border-0 bg-transparent disabled:cursor-progress disabled:opacity-50'
                            onClick={openFilePicker}
                            disabled={isUploading}
                        >
                            <span className={cn(WELL_CLASS, 'bg-foreground text-canvas')}>
                                <Plus className='size-5.5' aria-hidden='true' />
                            </span>
                        </button>
                    </li>
                )}

                {canAccess(['ai-conversation:read']) && (
                    <Tab label='VOLT AI' icon={Sparkles} to='/dashboard/ai' isActive={panel === 'ai'} />
                )}

                <Tab
                    label='Settings'
                    icon={Settings}
                    to={settingsPath}
                    isActive={panel === 'settings' || panel === 'secret-keys'}
                />
            </ul>
        </nav>
    );
};

export default DashboardTabBar;
