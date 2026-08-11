import HeaderBreadcrumbs from '@/modules/dashboard/components/HeaderBreadcrumbs';
import GlobalSearch from '@/modules/dashboard/components/GlobalSearch';
import { TeamInvitePanelPopover } from '@/modules/team/components/TeamInvitePanelPopover';
import AIFloatingAssistantPanel from '@/modules/ai/components/AIFloatingAssistantPanel';
import NotificationsPopover from '@/modules/notification/components/NotificationsPopover';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useSingleTenant } from '@/modules/system/hooks/use-single-tenant';
import type { DashboardGlobalSearchBreadcrumb } from '@/modules/dashboard/hooks/use-dashboard-header-context';
import { Button, Tooltip } from '@heroui/react';
import ThemeToggleButton from '@/shared/ui/components/ThemeToggleButton';
import WindowControls from '@/shared/ui/components/WindowControls';
import { Menu, UserPlus } from 'lucide-react';

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
            <div className='flex flex-row items-center flex-1 min-w-0 max-[768px]:flex-auto max-[768px]:overflow-hidden'>
                <HeaderBreadcrumbs />
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
