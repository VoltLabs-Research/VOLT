import GlobalSearch from '@/modules/dashboard/components/GlobalSearch';
import DashboardJobsChip from '@/modules/dashboard/components/DashboardJobsChip';
import { TeamInvitePanelPopover } from '@/modules/team/components/TeamInvitePanelPopover';
import TeamSelector from '@/modules/team/components/TeamSelector';
import AIFloatingAssistantPanel from '@/modules/ai/components/AIFloatingAssistantPanel';
import NotificationsPopover from '@/modules/notification/components/NotificationsPopover';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useSingleTenant } from '@/modules/system/hooks/use-single-tenant';
import { openModal } from '@/shared/ui/modal/use-modal-store';
import type { DashboardGlobalSearchBreadcrumb } from '@/modules/dashboard/hooks/use-dashboard-header-context';
import {
    Button,
    DropdownItem,
    DropdownMenu,
    DropdownPopover,
    DropdownRoot,
    DropdownTrigger,
    Tooltip,
    cn
} from '@heroui/react';
import ThemeToggleButton from '@/shared/ui/components/ThemeToggleButton';
import WindowControls from '@/shared/ui/components/WindowControls';
import { Menu, PanelLeft, Plus, Search, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

// The header's icon buttons: 36px, muted until hovered.
const HEADER_ICON_BUTTON_CLASS = 'rounded-lg text-muted hover:bg-foreground/6 hover:text-foreground';

interface DashboardHeaderProps {
    setSidebarOpen: (status: boolean) => void;
    isSidebarCollapsed: boolean;
    onToggleSidebar: () => void;
    globalSearchBreadcrumb?: DashboardGlobalSearchBreadcrumb | null;
}

const DashboardHeader = ({
    setSidebarOpen,
    isSidebarCollapsed,
    onToggleSidebar,
    globalSearchBreadcrumb
}: DashboardHeaderProps) => {
    const { pathname } = useLocation();
    const { canAccess } = useTeamPermissions();
    const singleTenant = useSingleTenant();
    const canInvite = canAccess(['team-invitation:create']);
    // On a phone the search is a button that opens the field over the header.
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const sidebarToggleLabel = isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar';

    useEffect(() => {
        setIsSearchOpen(false);
    }, [pathname]);

    let inviteAction = (
        <Tooltip>
            <Tooltip.Trigger>
                <Button isIconOnly variant='ghost' className={HEADER_ICON_BUTTON_CLASS} isDisabled aria-label='Invite members'>
                    <UserPlus size={18} />
                </Button>
            </Tooltip.Trigger>
            <Tooltip.Content placement='bottom'>You must be an admin or owner to invite members</Tooltip.Content>
        </Tooltip>
    );

    if (canInvite) {
        inviteAction = <TeamInvitePanelPopover />;
    }

    return (
        <header className='relative flex h-14 shrink-0 flex-row items-center gap-2 px-4 lg:px-6'>
            {/* The team keeps its name and the search gives way; only a phone, without the search, truncates it. */}
            <div className='flex min-w-0 flex-1 flex-row items-center gap-0.5 sm:min-w-max'>
                <Button
                    isIconOnly
                    variant='ghost'
                    className={cn(HEADER_ICON_BUTTON_CLASS, 'lg:hidden')}
                    aria-label='Open navigation'
                    onPress={() => setSidebarOpen(true)}
                >
                    <Menu size={18} />
                </Button>

                <Tooltip>
                    <Button
                        isIconOnly
                        variant='ghost'
                        className={cn(HEADER_ICON_BUTTON_CLASS, 'max-lg:hidden')}
                        aria-label={sidebarToggleLabel}
                        onPress={onToggleSidebar}
                    >
                        <PanelLeft size={18} />
                    </Button>
                    <Tooltip.Content placement='bottom'>{sidebarToggleLabel}</Tooltip.Content>
                </Tooltip>

                {!singleTenant && (
                    <>
                        <TeamSelector />

                        <DropdownRoot>
                            <Tooltip>
                                <DropdownTrigger
                                    className='flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-muted transition-colors duration-150 hover:bg-foreground/6 hover:text-foreground'
                                    aria-label='Team actions'
                                >
                                    <Plus size={16} aria-hidden='true' />
                                </DropdownTrigger>
                                <Tooltip.Content placement='bottom'>Team actions</Tooltip.Content>
                            </Tooltip>
                            <DropdownPopover placement='bottom end'>
                                <DropdownMenu aria-label='Team actions'>
                                    <DropdownItem id='create-team' textValue='Create team' onAction={() => openModal('team-creator-modal')}>
                                        <Plus size={16} aria-hidden='true' />
                                        Create team
                                    </DropdownItem>
                                    <DropdownItem id='join-team' textValue='Join existing team' onAction={() => openModal('join-team-modal')}>
                                        <UserPlus size={16} aria-hidden='true' />
                                        Join existing team
                                    </DropdownItem>
                                </DropdownMenu>
                            </DropdownPopover>
                        </DropdownRoot>
                    </>
                )}
            </div>

            <div
                className={cn(
                    'flex min-w-0 flex-row items-center justify-center gap-2 sm:flex-[0_1_25rem]',
                    isSearchOpen ? 'max-sm:absolute max-sm:inset-0 max-sm:z-10 max-sm:bg-canvas max-sm:px-4' : 'max-sm:hidden'
                )}
            >
                <GlobalSearch
                    contextBreadcrumb={globalSearchBreadcrumb}
                    autoFocus={isSearchOpen}
                    onDismiss={isSearchOpen ? () => setIsSearchOpen(false) : undefined}
                />
            </div>

            <div className='flex flex-1 shrink-0 flex-row items-center justify-end gap-1'>
                <Button
                    isIconOnly
                    variant='ghost'
                    className={cn(HEADER_ICON_BUTTON_CLASS, 'sm:hidden')}
                    aria-label='Search'
                    onPress={() => setIsSearchOpen(true)}
                >
                    <Search size={18} />
                </Button>

                <DashboardJobsChip />

                {!singleTenant && <span className='contents max-sm:hidden'>{inviteAction}</span>}

                <ThemeToggleButton />
                <AIFloatingAssistantPanel />
                <NotificationsPopover />
                <WindowControls />
            </div>
        </header>
    );
};

export default DashboardHeader;
