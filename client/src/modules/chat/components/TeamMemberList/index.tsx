import { cn } from '@heroui/react';
import { Check } from 'lucide-react';
import UserAvatar from '../UserAvatar';
import type { User } from '@volt/contracts/modules/auth/domain';

interface TeamMemberListProps {
    members: User[];
    selectedIds: string[];
    currentUserId?: string;
    onToggle: (userId: string) => void;
}

/*
 * See ChatListItem for why bravais's ListRow is spelled out at each call site.
 * This one is a `role='checkbox'` row, so the selected state is `aria-checked`;
 * bravais also emitted `aria-pressed` alongside it, which role=checkbox does not
 * support and which no assistive technology could act on.
 */
const ROW_CLASS_NAMES = 'flex w-full items-center gap-3 min-h-12 p-3 rounded-xl border border-transparent bg-transparent text-left text-inherit cursor-pointer transition-colors duration-200 hover:bg-surface-tertiary focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--border),0_0_0_3px_var(--focus)]';

const SELECTED_CLASS_NAMES = 'bg-surface-tertiary border-accent';

/*
 * The checkbox is drawn rather than composed from HeroUI's `Checkbox`: the whole
 * row is the control, so a second focusable element inside it would be a second
 * tab stop for the same choice. `.team-member-item.selected
 * .team-member-item-checkbox` was a descendant rule; the selected classes are
 * applied here directly instead.
 */
const CHECKBOX_CLASS_NAMES = 'flex shrink-0 items-center justify-center size-5 rounded-md border-2 border-border transition-colors duration-200 ease-out-fluid';

const CHECKBOX_SELECTED_CLASS_NAMES = 'bg-accent border-accent';

const TeamMemberList = ({ members, selectedIds, currentUserId, onToggle }: TeamMemberListProps) => {
    const filteredMembers = members.filter((m) => m._id !== currentUserId);

    const renderMember = (member: User) => {
        const isSelected = selectedIds.includes(member._id);

        return (
            <button
                key={member._id}
                type='button'
                className={cn(ROW_CLASS_NAMES, isSelected && SELECTED_CLASS_NAMES)}
                role='checkbox'
                aria-checked={isSelected}
                onClick={() => onToggle(member._id)}
            >
                <div className='flex flex-row items-center gap-2 shrink-0' aria-hidden='true'>
                    <div className={cn(CHECKBOX_CLASS_NAMES, isSelected && CHECKBOX_SELECTED_CLASS_NAMES)}>
                        {isSelected && <Check size={14} className='text-accent-foreground' />}
                    </div>
                    <UserAvatar user={member} size='sm' />
                </div>

                <div className='flex flex-col gap-0.5 flex-1 min-w-0'>
                    <span className='text-sm font-medium text-foreground truncate'>
                        {`${member.firstName} ${member.lastName}`}
                    </span>
                    <span className='text-xs text-muted truncate'>
                        {member.email}
                    </span>
                </div>
            </button>
        );
    };

    if (filteredMembers.length === 0) {
        return (
            <div className='flex p-8 text-center items-center justify-center'>
                <p className='text-sm text-muted'>No team members available</p>
            </div>
        );
    }

    return (
        <div className='flex flex-col gap-1 overflow-y-auto max-h-[300px]'>
            {filteredMembers.map(renderMember)}
        </div>
    );
};

export default TeamMemberList;
