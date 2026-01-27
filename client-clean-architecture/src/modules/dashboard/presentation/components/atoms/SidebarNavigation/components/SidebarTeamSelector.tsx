import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTeamStore } from '@/modules/team/presentation/stores';
import useTeamStateReset from '@/modules/team/presentation/hooks/use-team-state-reset';
import useToast from '@/shared/presentation/hooks/ui/use-toast';
import Select from '@/shared/presentation/components/atoms/form/Select';
import Container from '@/shared/presentation/components/primitives/Container';
import { IoIosAdd } from 'react-icons/io';

const SidebarTeamSelector = () => {
    const [, setSearchParams] = useSearchParams();
    const teams = useTeamStore((state) => state.teams);
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const setSelectedTeam = useTeamStore((state) => state.setSelectedTeam);
    const leaveTeam = useTeamStore((state) => state.leaveTeam);
    const { resetAllTeamState } = useTeamStateReset();
    const { showError, showSuccess } = useToast();

    const handleTeamChange = (teamId: string) => {
        if (selectedTeam?._id === teamId) return;
        resetAllTeamState();
        setSelectedTeam(teamId);
        setSearchParams({ team: teamId });
    };

    const handleLeaveTeam = async (teamId: string) => {
        try {
            await leaveTeam(teamId);
            const state = useTeamStore.getState();
            const remainingTeams = state.teams;
            const currentSelected = state.selectedTeam;

            if (currentSelected?._id === teamId && remainingTeams.length > 0) {
                const newTeamId = remainingTeams[0]._id;
                setSelectedTeam(newTeamId);
                resetAllTeamState();
                setSearchParams({ team: newTeamId });
            }
            showSuccess(`Left team successfully`);
        } catch (err: any) {
            const errorMessage = err?.message || 'Failed to leave team';
            showError(errorMessage);
        }
    };

    const teamOptions = useMemo(() =>
        teams.map(team => ({
            value: team._id,
            title: team.name,
            description: team.description || undefined
        })), [teams]
    );

    return (
        <>
            <div className='sidebar-divider' />
            <Container className='sidebar-team-section'>
                <Select
                    options={teamOptions}
                    value={selectedTeam?._id || null}
                    onChange={handleTeamChange}
                    onLeaveTeam={handleLeaveTeam}
                    className="team-select"
                />
            </Container>

            <button
                className='sidebar-nav-item p-relative gap-075 w-max font-size-2 font-weight-4 color-secondary cursor-pointer'
                commandfor="team-creator-modal"
                command="show-modal"
            >
                <span className='sidebar-nav-icon font-size-4'>
                    <IoIosAdd />
                </span>
                <span className='sidebar-nav-label'>Create Team</span>
            </button>
        </>
    );
};

export default SidebarTeamSelector;
