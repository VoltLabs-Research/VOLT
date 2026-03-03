import { useMemo, useCallback } from 'react';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import { IoExitOutline } from 'react-icons/io5';
import Select, { type SelectOption } from '@/shared/presentation/components/Select';
import IconButton from '@/shared/presentation/components/IconButton';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import { useSelectedTeam } from '@/modules/team/presentation/hooks/use-selected-team';
import useTeamUseCases from '@/modules/team/presentation/hooks/team/use-team-use-cases';
import useTeamData from '@/modules/team/presentation/hooks/team/use-team-data';
import './TeamSelector.css';

interface TeamSelectorProps {
    className?: string;
};

const TeamSelector = ({ className = '' }: TeamSelectorProps) => {
    const { updateSearchParams } = useSearchParamsState();
    const teams = useTeamStore((state) => state.teams);
    const selectedTeam = useSelectedTeam();
    const { teamRepository } = useTeamUseCases();
    const { hydrateTeamAccess } = useTeamData();

    const handleTeamChange = useCallback((teamId: string) => {
        if (selectedTeam?._id === teamId) return;

        const teamStore = useTeamStore.getState();
        teamStore.selectTeamById(teamId);
        hydrateTeamAccess(teamId);
        updateSearchParams({ team: teamId }, { replace: true });
    }, [selectedTeam?._id, hydrateTeamAccess, updateSearchParams]);

    const handleLeaveTeam = useCallback(async (e: React.MouseEvent, teamId: string) => {
        e.preventDefault();
        e.stopPropagation();

        try {
            await teamRepository.leave(teamId);

            const state = useTeamStore.getState();
            const remainingTeams = state.teams;
            const currentSelected = state.selectedTeam;

            if (currentSelected?._id === teamId && remainingTeams.length > 0) {
                const newTeamId = remainingTeams[0]._id;
                state.selectTeamById(newTeamId);
                hydrateTeamAccess(newTeamId);
                updateSearchParams({ team: newTeamId }, { replace: true });
            }
        } catch (err: unknown) {
            console.error('Failed to leave team:', err);
        }
    }, [teamRepository, hydrateTeamAccess, updateSearchParams]);

    const teamOptions = useMemo(() =>
        teams.map(team => ({
            value: team._id,
            title: team.name,
            description: team.description || undefined
        })), [teams]
    );

    const renderLeaveAction = useCallback((option: SelectOption) => (
        <IconButton
            size='sm'
            variant='ghost'
            className='team-selector-leave'
            onClick={(e) => handleLeaveTeam(e, option.value)}
            title='Leave team'
        >
            <IoExitOutline size={16} />
        </IconButton>
    ), [handleLeaveTeam]);

    return (
        <Select
            options={teamOptions}
            value={selectedTeam?._id || null}
            onChange={handleTeamChange}
            renderOptionAction={renderLeaveAction}
            className={`team-selector ${className}`}
        />
    );
};

export default TeamSelector;
