import type { ReactNode } from 'react';
import { Chip, cn } from '@heroui/react';
import UserAvatar from '../UserAvatar';
import type { User } from '@volt/contracts/modules/auth/domain';

type MemberRole = 'owner' | 'admin' | 'member';

interface MemberListItemProps {
    user: User;
    role?: MemberRole;
    action?: ReactNode;
    onClick?: () => void;
    className?: string;
};

/*
 * bravais's Tag crossed a tone with a variant; HeroUI's Chip is token-driven
 * (`--chip-bg` / `--chip-fg`), so a solid tone is two utilities. `member` is the
 * one that needs none: Chip's own default is already the neutral fill that
 * `tone='neutral' variant='soft'` painted.
 *
 * `admin` was `tone='brand' variant='solid'`, which hardcoded `#ffffff` for its
 * text — legible against bravais's blue, near-invisible against VOLT's monochrome
 * accent. `text-accent-foreground` is the ink that accent surface actually wants.
 */
const ROLE_CHIP_CLASS_NAMES: Record<MemberRole, string> = {
    owner: 'bg-info text-info-foreground',
    admin: 'bg-accent text-accent-foreground',
    member: ''
};

/* See ChatListItem for why the row is spelled out rather than shared. */
const ROW_CLASS_NAMES = 'flex w-full items-center gap-3 p-3 rounded-xl border border-transparent bg-transparent text-left text-inherit';

const INTERACTIVE_CLASS_NAMES = 'min-h-12 cursor-pointer transition-colors duration-200 hover:bg-surface-tertiary focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--border),0_0_0_3px_var(--focus)]';

export const MemberListItem = ({ user, role, action, onClick, className }: MemberListItemProps) => {
    const fullName = `${user.firstName} ${user.lastName}`;

    let trailing: ReactNode = null;
    if (role || action) {
        trailing = (
            <div className='inline-flex items-center gap-2 shrink-0 ml-auto text-muted'>
                {role && (
                    <Chip size='sm' className={ROLE_CHIP_CLASS_NAMES[role]}>
                        <Chip.Label>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                        </Chip.Label>
                    </Chip>
                )}
                {action}
            </div>
        );
    }

    const content = (
        <>
            <div className='flex items-center shrink-0' aria-hidden='true'>
                <UserAvatar user={user} size='sm' />
            </div>

            <div className='flex flex-col gap-0.5 flex-1 min-w-0'>
                <span className='text-sm font-medium text-foreground truncate'>
                    {fullName}
                </span>
            </div>

            {trailing}
        </>
    );

    if (onClick) {
        return (
            <button
                type='button'
                className={cn(ROW_CLASS_NAMES, INTERACTIVE_CLASS_NAMES, className)}
                onClick={onClick}
            >
                {content}
            </button>
        );
    }

    return (
        <div className={cn(ROW_CLASS_NAMES, className)}>
            {content}
        </div>
    );
};
