import IconButton from '@/shared/presentation/primitives/IconButton';
import Popover from '@/shared/presentation/primitives/Popover';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { TeamInvitePanel } from '@/modules/team/components/TeamInvitePanel';
import { GoPersonAdd } from 'react-icons/go';

export const TeamInvitePanelPopover = () => {
    const selectedTeam = useSelectedTeam();
    
    return (
        <Popover
            id='invite-members-popover'
            trigger={
                <IconButton title='Invite members' aria-label='Invite team members'>
                    <GoPersonAdd size={18} />
                </IconButton>
            }
            className='team-invite-panel-popover glass-bg d-flex column overflow-hidden'
            noPadding
        >
            {(closePopover) => selectedTeam && (
                <TeamInvitePanel onClose={closePopover} />
            )}
        </Popover>
    );
};
