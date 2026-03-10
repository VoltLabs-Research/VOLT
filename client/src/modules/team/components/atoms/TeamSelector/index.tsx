import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useLeaveTeamMutation } from '@/modules/team/hooks/team/queries';
import { resetTeamScopedApplicationState, useTeamStore } from '@/modules/team/stores/team/use-team-store';
import { runHandledAction } from '@/shared/errors/handled-action';
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import IconButton from '@/shared/presentation/components/IconButton';
import Select from '@/shared/presentation/components/Select';
import { createPromiseToastOptions } from '@/shared/presentation/toast-options';
import { IoExitOutline } from 'react-icons/io5';
import { useCallback, useMemo } from 'react';
import type { SelectOption } from '@/shared/presentation/components/Select';
import type { MouseEvent } from 'react';
import './TeamSelector.css';

interface TeamSelectorProps {
    className?: string;
};

const LEAVE_TEAM_TOAST_OPTIONS = createPromiseToastOptions({
    loading: 'Leaving team...',
    success: 'Left team successfully',
    error: 'Failed to leave team'
});

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

        await runHandledAction({
            action: () => leaveTeamMutation.mutateAsync({ teamId }),
            toast: LEAVE_TEAM_TOAST_OPTIONS,
            afterSuccess: () => {
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
            },
            rethrow: false
        });
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
