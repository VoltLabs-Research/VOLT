import { IconButton, Popover } from '@voltstack/bravais';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { TeamInvitePanel } from '@/modules/team/components/TeamInvitePanel';
import { UserPlus } from 'lucide-react';

export const TeamInvitePanelPopover = () => {
    const selectedTeam = useSelectedTeam();
    
    return (
        <Popover
            id='invite-members-popover'
            trigger={
                <IconButton title='Invite members' aria-label='Invite team members'>
                    <UserPlus size={18} />
                </IconButton>
            }
            className='team-invite-panel-popover bg-surface border border-border flex flex-col overflow-hidden'
            noPadding
        >
            {(closePopover) => selectedTeam && (
                <TeamInvitePanel onClose={closePopover} />
            )}
        </Popover>
    );
};
