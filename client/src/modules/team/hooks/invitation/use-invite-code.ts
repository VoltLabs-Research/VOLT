import { useGenerateInviteCodeMutation, useDeleteInviteCodeMutation, useTeamsQuery } from '@/modules/team/hooks/team/queries';
import { ErrorSurface, executeTask } from '@/shared/errors/core';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { runAction } from '@/shared/presentation/actions/run-action';
import { ConfirmActionTone } from '@/shared/presentation/hooks/use-confirm';
import { createPromiseToastOptions } from '@/shared/presentation/toast-options';
import { copyTextToClipboard } from '@/shared/presentation/utilities/copy-to-clipboard';
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

const getTeamInviteLink = (inviteCode: string): string => {
    const invitePath = `/team-invitation/code/${inviteCode}`;

    if (typeof window === 'undefined') {
        return invitePath;
    }

    return new URL(invitePath, window.location.origin).toString();
};

interface UseInviteCodeReturn {
    inviteCode: string | null;
    canManageCode: boolean;
    isGenerating: boolean;
    isDeleting: boolean;
    handleGenerate: () => Promise<void>;
    handleDelete: () => Promise<void>;
    handleCopy: () => Promise<void>;
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
        await executeTask({
            action: () => runAction({
                action: () => generateMutation.mutateAsync({ teamId }),
                toast: GENERATE_INVITE_CODE_TOAST_OPTIONS
            }),
            surface: ErrorSurface.Silent,
            rethrow: false
        });
    }, [generateMutation, teamId]);

    const handleDelete = useCallback(async () => {
        if (!teamId) return;
        await executeTask({
            action: () => runAction({
                action: () => deleteMutation.mutateAsync({ teamId }),
                confirm: {
                    title: 'Delete this invite code?',
                    description: 'Anyone using this code will no longer be able to join the team with it.',
                    confirmText: 'Delete code',
                    cancelText: 'Keep code',
                    tone: ConfirmActionTone.Danger
                },
                toast: DELETE_INVITE_CODE_TOAST_OPTIONS
            }),
            surface: ErrorSurface.Silent,
            rethrow: false
        });
    }, [deleteMutation, teamId]);

    const handleCopy = useCallback(async () => {
        if (!selectedTeam?.inviteCode) return;

        await copyTextToClipboard(getTeamInviteLink(selectedTeam.inviteCode), {
            successMessage: 'Invite link copied to clipboard'
        });
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
