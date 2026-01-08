import Popover from '@/components/molecules/common/Popover';
import TeamInvitePanel from '@/features/team/components/organisms/TeamInvitePanel';
import { useTeamStore } from '@/stores/slices/team';
import { GoPersonAdd } from 'react-icons/go';

const TeamInvitePanelPopover = () => {
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    
    return (
        <Popover
            id="invite-members-popover"
            trigger={
                <button
                    className='d-flex content-center items-center badge-container as-icon-container over-light-bg'
                    title='Invite members'
                >
                    <GoPersonAdd size={18} />
                </button>
            }
            className="team-invite-panel glass-bg d-flex column overflow-hidden"
            noPadding
        >
            {(closePopover) => selectedTeam && (
                <TeamInvitePanel
                    teamName={selectedTeam.name}
                    teamId={selectedTeam._id}
                    onClose={closePopover}
                />
            )}
        </Popover>
    );
};

export default TeamInvitePanelPopover;