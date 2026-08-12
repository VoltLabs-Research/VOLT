import Loader from '@/shared/ui/components/Loader';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import UserAvatar from '@/modules/auth/components/UserAvatar';
import UserInfo from '@/modules/auth/components/UserInfo';
import { DropdownItem, DropdownMenu, DropdownPopover, DropdownRoot, DropdownTrigger } from '@heroui/react';
import { EllipsisVertical, Settings, X } from 'lucide-react';
import type { ReactNode } from 'react';

interface UserMenuPopoverProps {
    onSettingsClick: () => void;
    onSignOut: () => void;
    isSigningOut?: boolean;
    trigger?: ReactNode;
    collapsed?: boolean;
}

const UserMenuPopover = ({ onSettingsClick, onSignOut, isSigningOut = false, trigger, collapsed = false }: UserMenuPopoverProps) => {
    const user = useCurrentUser();

    let triggerContent: ReactNode = (
        <>
            <UserInfo user={user} />
            <EllipsisVertical size={16} className='shrink-0' aria-hidden='true' />
        </>
    );

    if (collapsed) {
        triggerContent = <UserAvatar user={user} size='sm' />;
    }

    if (trigger) {
        triggerContent = trigger;
    }

    return (
        <DropdownRoot>
            <DropdownTrigger
                aria-label='Open user menu'
                className={collapsed
                    ? 'user-menu-trigger-collapsed flex w-full items-center justify-center rounded-lg p-2 transition-colors duration-150 hover:bg-surface-tertiary'
                    : 'flex w-full items-center rounded-lg p-3 text-left transition-colors duration-150 hover:bg-surface-tertiary'}
            >
                {triggerContent}
            </DropdownTrigger>
            <DropdownPopover placement='bottom start'>
                <DropdownMenu aria-label='User menu'>
                    <DropdownItem onAction={onSettingsClick}>
                        <Settings aria-hidden='true' />
                        Account Settings
                    </DropdownItem>
                    <DropdownItem onAction={onSignOut} isDisabled={isSigningOut}>
                        {isSigningOut ? <Loader size='sm' color='current' /> : <X aria-hidden='true' />}
                        Sign Out
                    </DropdownItem>
                </DropdownMenu>
            </DropdownPopover>
        </DropdownRoot>
    );
};

export default UserMenuPopover;
