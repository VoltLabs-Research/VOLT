import { GoPersonAdd } from 'react-icons/go';
import Popover from '@/shared/presentation/components/Popover';
import IconButton from '@/shared/presentation/components/IconButton';
import TeamInvitePanel from '@/modules/team/presentation/components/organisms/TeamInvitePanel';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';

const TeamInvitePanelPopover = () => {
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    
    return (
        <Popover
            id='invite-members-popover'
            trigger={
                <IconButton title='Invite members'>
                    <GoPersonAdd size={18} />
                </IconButton>
            }
            className='team-invite-panel glass-bg d-flex column overflow-hidden'
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
