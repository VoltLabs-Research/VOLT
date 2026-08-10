import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import UserAvatar from '@/modules/auth/components/UserAvatar';
import UserInfo from '@/modules/auth/components/UserInfo';
import { DropdownItem, DropdownMenu, DropdownPopover, DropdownRoot, DropdownTrigger, Spinner } from '@heroui/react';
import { EllipsisVertical, Settings, X } from 'lucide-react';
import type { ReactNode } from 'react';

/*
 * `user-menu-trigger-collapsed` stays on the element on purpose: it is a parent
 * contract, selected by `.dashboard-sidebar.is-collapsed
 * .user-menu-trigger-collapsed` in the dashboard module's stylesheet. The utility
 * classes below restate what this component's own (now deleted) sheet declared;
 * the collapsed layout still arrives from the sidebar.
 */
const TRIGGER = 'flex w-full items-center rounded-lg p-3 text-left transition-colors duration-150 hover:bg-surface-tertiary';
const TRIGGER_COLLAPSED = 'user-menu-trigger-collapsed flex w-full items-center justify-center rounded-lg p-2 transition-colors duration-150 hover:bg-surface-tertiary';

interface UserMenuPopoverProps {
    onSettingsClick: () => void;
    onSignOut: () => void;
    isSigningOut?: boolean;
    trigger?: ReactNode;
    collapsed?: boolean;
}

const UserMenuPopover = ({ onSettingsClick, onSignOut, isSigningOut = false, trigger, collapsed = false }: UserMenuPopoverProps) => {
    const user = useCurrentUser();

    let triggerClassName = TRIGGER;
    let triggerContent: ReactNode = (
        <>
            <UserInfo user={user} />
            <EllipsisVertical size={16} className='shrink-0' aria-hidden='true' />
        </>
    );

    if (collapsed) {
        triggerClassName = TRIGGER_COLLAPSED;
        triggerContent = <UserAvatar user={user} size='sm' />;
    }

    if (trigger) {
        triggerContent = trigger;
    }

    return (
        <DropdownRoot>
            <DropdownTrigger aria-label='Open user menu' className={triggerClassName}>
                {triggerContent}
            </DropdownTrigger>

            <DropdownPopover placement='bottom start'>
                {/*
                  * The old panel carried `gap-4 p-2`. `gap-4` was inert — bravais's
                  * popover panel was `display: block`, its `d-flex column` classes having
                  * been deleted from the library — so porting it would newly push the two
                  * items 1rem apart. The padding is HeroUI's own (`p-1.5` on the menu).
                  */}
                <DropdownMenu aria-label='User menu'>
                    <DropdownItem onAction={onSettingsClick}>
                        <Settings aria-hidden='true' />
                        Account Settings
                    </DropdownItem>
                    <DropdownItem onAction={onSignOut} isDisabled={isSigningOut}>
                        {isSigningOut ? <Spinner size='sm' color='current' /> : <X aria-hidden='true' />}
                        Sign Out
                    </DropdownItem>
                </DropdownMenu>
            </DropdownPopover>
        </DropdownRoot>
    );
};

export default UserMenuPopover;
