import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useLeaveTeamMutation } from '@/modules/team/hooks/team/queries';
import { resetTeamScopedApplicationState, useTeamStore } from '@/modules/team/stores/team/use-team-store';
import { showPromise } from '@/shared/presentation/hooks/toast';
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import ApiError from '@/shared/errors/ApiError';
import IconButton from '@/shared/presentation/components/IconButton';
import Select from '@/shared/presentation/components/Select';
import { IoExitOutline } from 'react-icons/io5';
import { useCallback, useMemo } from 'react';
import type { SelectOption } from '@/shared/presentation/components/Select';
import type { MouseEvent } from 'react';
import './TeamSelector.css';

interface TeamSelectorProps {
    className?: string;
};

interface PromiseToastOptions {
    loading: { title: string };
    success: { title: string };
    error: { title: string };
};

const LEAVE_TEAM_TOAST_OPTIONS: PromiseToastOptions = {
    loading: { title: 'Leaving team...' },
    success: { title: 'Left team successfully' },
    error: { title: 'Failed to leave team' }
};

export default function TeamSelector({ className = '' }: TeamSelectorProps) {
    const { teams } = useTeamData();
    const selectedTeamId = useSelectedTeamId();
    const leaveTeamMutation = useLeaveTeamMutation();

    const handleTeamChange = useCallback((teamId: string) => {
        if (selectedTeamId === teamId) return;

        resetTeamScopedApplicationState();
        useTeamStore.getState().setSelectedTeamId(teamId);
    }, [selectedTeamId]);

    const handleLeaveTeam = useCallback(async (event: MouseEvent, teamId: string) => {
        event.preventDefault();
        event.stopPropagation();

        try {
            await showPromise(leaveTeamMutation.mutateAsync({ teamId }), LEAVE_TEAM_TOAST_OPTIONS);

            const state = useTeamStore.getState();
            const currentSelectedTeamId = state.selectedTeamId;

            if (currentSelectedTeamId === teamId) {
                const remainingTeams = teams.filter((team) => team._id !== teamId);
                const nextTeam = remainingTeams[0] ?? null;

                if (nextTeam) {
                    resetTeamScopedApplicationState();
                    state.setSelectedTeamId(nextTeam._id);
                } else {
                    resetTeamScopedApplicationState();
                    state.setSelectedTeamId(null);
                }
            }
        } catch(error: unknown) {
            if(ApiError.isRBACError(error)) return;
        }
    }, [leaveTeamMutation, teams]);

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
            value={selectedTeamId || null}
            onChange={handleTeamChange}
            renderOptionAction={renderLeaveAction}
            className={`team-selector ${className}`}
        />
    );
};
