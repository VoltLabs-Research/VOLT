import { useLeaveTeamMutation } from '@/modules/team/hooks/team/queries';
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import { resetTeamScopedApplicationState, useTeamStore } from '@/modules/team/store/team/use-team-store';
import { runAction } from '@/shared/ui/actions/run-action';
import { confirm, ConfirmActionTone } from '@/shared/ui/hooks/use-confirm';
import { createPromiseToastOptions } from '@/shared/ui/utils/toast-options';
import { useCallback } from 'react';

const LEAVE_TEAM_TOAST_OPTIONS = createPromiseToastOptions({
    loading: 'Leaving team...',
    success: 'Left team successfully',
    error: 'Failed to leave team'
});

export default function useLeaveTeam() {
    const { teams } = useTeamData();
    const leaveTeamMutation = useLeaveTeamMutation();

    return useCallback(async (teamId: string, teamName?: string) => {
        const isConfirmed = await confirm({
            title: `Leave ${teamName ?? 'this team'}?`,
            description: 'You will lose access to this team until someone invites you again.',
            confirmText: 'Leave team',
            cancelText: 'Stay',
            tone: ConfirmActionTone.Danger
        });
        if (!isConfirmed) return;

        await runAction({
            action: () => leaveTeamMutation.mutateAsync({ teamId }),
            toast: LEAVE_TEAM_TOAST_OPTIONS,
            afterSuccess: () => {
                const state = useTeamStore.getState();
                if (state.selectedTeamId !== teamId) return;

                const nextTeam = teams.find((team) => team._id !== teamId) ?? null;
                resetTeamScopedApplicationState();
                state.setSelectedTeamId(nextTeam?._id ?? null);
            }
        });
    }, [leaveTeamMutation, teams]);
}
