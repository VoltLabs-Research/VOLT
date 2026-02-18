import { GoPersonAdd } from 'react-icons/go';
import Popover from '@/shared/presentation/components/Popover';
import IconButton from '@/shared/presentation/components/IconButton';
import TeamInvitePanel from '@/modules/team/presentation/components/organisms/TeamInvitePanel';
import { useSelectedTeam } from '@/modules/team/presentation/hooks/use-selected-team';

const TeamInvitePanelPopover = () => {
    const selectedTeam = useSelectedTeam();
    
    return (
        <Popover
            id='invite-members-popover'
            trigger={
                <IconButton title='Invite members'>
                    <GoPersonAdd size={18} />
                </IconButton>
            }
            className='team-invite-panel-popover glass-bg d-flex column overflow-hidden'
            noPadding
        >
            {(closePopover) => selectedTeam && (
                <TeamInvitePanel
                    teamId={selectedTeam._id}
                    onClose={closePopover}
                />
            )}
        </Popover>
    );
};

export default TeamInvitePanelPopover;
