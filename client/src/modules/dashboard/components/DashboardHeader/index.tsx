import GlobalSearch from '@/modules/dashboard/components/GlobalSearch';
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
    Tooltip
} from '@heroui/react';
import ThemeToggleButton from '@/shared/ui/components/ThemeToggleButton';
import WindowControls from '@/shared/ui/components/WindowControls';
import { Menu, Plus, UserPlus } from 'lucide-react';

interface DashboardHeaderProps {
    setSidebarOpen: (status: boolean) => void;
    globalSearchBreadcrumb?: DashboardGlobalSearchBreadcrumb | null;
}

const DashboardHeader = ({
    setSidebarOpen,
    globalSearchBreadcrumb
}: DashboardHeaderProps) => {
    const { canAccess } = useTeamPermissions();
    const singleTenant = useSingleTenant();
    const canInvite = canAccess(['team-invitation:create']);

    let inviteAction = (
        <Tooltip>
            <Tooltip.Trigger>
                <Button isIconOnly variant='ghost' isDisabled aria-label='Invite members'>
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
        <header className='dashboard-top-header flex flex-row items-center gap-4 sticky top-0 z-50 px-8 py-4 max-[768px]:flex-wrap max-[768px]:gap-2 max-[768px]:p-3'>
            <Button
                isIconOnly
                variant='ghost'
                className='hidden rounded-md bg-transparent border-none hover:bg-surface-hover max-[1024px]:flex'
                aria-label='Open sidebar'
                onPress={() => setSidebarOpen(true)}
            >
                <Menu size={20} />
            </Button>
            <div className='flex flex-row items-center gap-1.5 flex-1 min-w-0 max-[768px]:flex-auto max-[768px]:overflow-hidden'>
                {!singleTenant && (
                    <>
                        <TeamSelector />

                        <DropdownRoot>
                            <Tooltip>
                                <DropdownTrigger
                                    className='flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-foreground'
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
            <div className='flex justify-center w-[min(400px,100%)] min-w-0 flex-[0_1_400px] max-[768px]:order-4 max-[768px]:w-full max-[768px]:flex-[1_1_100%]'>
                <GlobalSearch contextBreadcrumb={globalSearchBreadcrumb} />
            </div>
            <div className='flex flex-row items-center justify-end gap-2 flex-1 max-[768px]:min-w-0 max-[768px]:flex-none max-[768px]:gap-1'>
                {!singleTenant && <span className='contents max-[768px]:hidden'>{inviteAction}</span>}

                <ThemeToggleButton />
                <AIFloatingAssistantPanel />
                <NotificationsPopover />
                <WindowControls />
            </div>
        </header>
    );
};

export default DashboardHeader;
