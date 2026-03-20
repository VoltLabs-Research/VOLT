import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useLeaveTeamMutation } from '@/modules/team/hooks/team/queries';
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import { resetTeamScopedApplicationState, switchSelectedTeam, useTeamStore } from '@/modules/team/stores/team/use-team-store';
import { runAction } from '@/shared/presentation/actions/run-action';
import IconButton from '@/shared/presentation/components/IconButton';
import Select from '@/shared/presentation/components/Select';
import { confirm, ConfirmActionTone } from '@/shared/presentation/hooks/use-confirm';
import { createPromiseToastOptions } from '@/shared/presentation/toast-options';
import useTip from '@/shared/tips/use-tip';
import { IoExitOutline } from 'react-icons/io5';
import { useCallback, useMemo, useState } from 'react';
import type { SelectOption } from '@/shared/presentation/components/Select';
import type { MouseEvent } from 'react';
import './TeamSelector.css';

interface TeamSelectorProps {
    className?: string;
};

const toOptionalDescription = (value: string | null | undefined): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const normalizedValue = value.trim();
    return normalizedValue.length > 0 ? normalizedValue : undefined;
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
    const [tipTrigger, setTipTrigger] = useState(0);

    useTip('team-selector-context', {
        enabled: tipTrigger > 0,
        triggerKey: tipTrigger
    });

    const handleTeamChange = useCallback((teamId: string) => {
        if (selectedTeamId === teamId) return;

        switchSelectedTeam(teamId);
    }, [selectedTeamId]);

    const handleLeaveTeam = useCallback(async (event: MouseEvent, teamId: string) => {
        event.preventDefault();
        event.stopPropagation();

        const team = teams.find((entry) => entry._id === teamId);
        const isConfirmed = await confirm({
            title: `Leave ${team?.name ?? 'this team'}?`,
            description: 'You will lose access to this team until someone invites you again.',
            confirmText: 'Leave team',
            cancelText: 'Stay',
            tone: ConfirmActionTone.Danger
        });

        if (!isConfirmed) {
            return;
        }

        await runAction({
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
            }
        });
    }, [confirm, leaveTeamMutation, teams]);

    const teamOptions = useMemo(() =>
        teams.map((team) => ({
            value: team._id,
            title: team.name,
            description: toOptionalDescription(team.description)
        })), [teams]
    );

    const renderLeaveAction = useCallback((option: SelectOption) => (
        <IconButton
            size='sm'
            variant='ghost'
            className='team-selector-leave'
            onClick={(e) => handleLeaveTeam(e, option.value)}
            title='Leave team'
            aria-label={`Leave ${option.title}`}
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
            title='Switch team'
            onFocusCapture={() => setTipTrigger((current) => current + 1)}
        />
    );
};
