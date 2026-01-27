import Popover from '@/shared/presentation/components/molecules/common/Popover';
import TeamInvitePanel from '@/modules/team/presentation/components/organisms/TeamInvitePanel';
import { useTeamStore } from '@/modules/team/presentation/stores';
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
