import { useGenerateInviteCodeMutation, useDeleteInviteCodeMutation, useTeamsQuery } from '@/modules/team/hooks/team/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { runHandledAction } from '@/shared/errors/handled-action';
import { createPromiseToastOptions } from '@/shared/presentation/toast-options';
import { useCallback, useMemo } from 'react';

const GENERATE_INVITE_CODE_TOAST_OPTIONS = createPromiseToastOptions({
    loading: 'Generating invite code...',
    success: 'Invite code generated',
    error: 'Failed to generate invite code'
});

const DELETE_INVITE_CODE_TOAST_OPTIONS = createPromiseToastOptions({
    loading: 'Deleting invite code...',
    success: 'Invite code deleted',
    error: 'Failed to delete invite code'
});

interface UseInviteCodeReturn {
    inviteCode: string | null;
    canManageCode: boolean;
    isGenerating: boolean;
    isDeleting: boolean;
    handleGenerate: () => Promise<void>;
    handleDelete: () => Promise<void>;
    handleCopy: () => void;
};

export default function useInviteCode(): UseInviteCodeReturn {
    const teamId = useSelectedTeamId();
    const { canAccess } = useTeamPermissions();

    const teamsQuery = useTeamsQuery();
    const selectedTeam = useMemo(() => {
        return teamsQuery.data?.find((team) => team._id === teamId) ?? null;
    }, [teamsQuery.data, teamId]);

    const canManageCode = canAccess(['team-invitation:create']);

    const generateMutation = useGenerateInviteCodeMutation();
    const deleteMutation = useDeleteInviteCodeMutation();

    const handleGenerate = useCallback(async () => {
        if (!teamId) return;
        await runHandledAction({
            action: () => generateMutation.mutateAsync({ teamId }),
            toast: GENERATE_INVITE_CODE_TOAST_OPTIONS,
            rethrow: false
        });
    }, [generateMutation, teamId]);

    const handleDelete = useCallback(async () => {
        if (!teamId) return;
        await runHandledAction({
            action: () => deleteMutation.mutateAsync({ teamId }),
            toast: DELETE_INVITE_CODE_TOAST_OPTIONS,
            rethrow: false
        });
    }, [deleteMutation, teamId]);

    const handleCopy = useCallback(() => {
        if (!selectedTeam?.inviteCode) return;
        navigator.clipboard.writeText(selectedTeam.inviteCode);
    }, [selectedTeam]);

    return {
        inviteCode: selectedTeam?.inviteCode ?? null,
        canManageCode,
        isGenerating: generateMutation.isPending,
        isDeleting: deleteMutation.isPending,
        handleGenerate,
        handleDelete,
        handleCopy
    };
}
