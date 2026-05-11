import { getClusterOnboardingRedirectPath } from '@/modules/auth/services/post-auth-destination-storage';
import type { DeleteDemoTeamClusterOutputDTO } from '@/modules/cluster/api/service';
import { useDeleteDemoTeamClusterMutation } from '@/modules/cluster/hooks/team-cluster/queries';
import { useDemoClusterStore } from '@/modules/cluster/stores/use-demo-cluster-store';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { confirm, ConfirmActionTone } from '@/shared/presentation/hooks/use-confirm';
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const END_DEMO_SESSION_TOAST = {
    loading: { title: 'Ending demo session...' },
    success: (result: DeleteDemoTeamClusterOutputDTO) => ({
        title: result.teardownScheduled ? 'Demo session ended' : 'No active demo session',
        description: result.teardownScheduled
            ? 'Your temporary cluster is shutting down.'
            : 'Your temporary cluster was already unavailable.'
    }),
    error: { title: 'Failed to end demo session' }
};

const getCurrentDestination = (pathname: string, search: string, hash: string) => {
    return `${pathname}${search}${hash}`;
};

export const useDemoSessionActions = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const selectedTeamId = useSelectedTeamId();
    const clearDemo = useDemoClusterStore((state) => state.clear);
    const deleteDemoMutation = useDeleteDemoTeamClusterMutation();

    const endSession = useCallback(async () => {
        if (!selectedTeamId || deleteDemoMutation.isPending) {
            return;
        }

        const isConfirmed = await confirm({
            title: 'End demo session?',
            description: 'This shuts down your temporary cluster and sends you back to cluster onboarding.',
            confirmText: 'End session',
            cancelText: 'Keep demo',
            tone: ConfirmActionTone.Danger
        });

        if (!isConfirmed) {
            return;
        }

        await showPromise(
            deleteDemoMutation.mutateAsync({ teamId: selectedTeamId }),
            END_DEMO_SESSION_TOAST
        );

        clearDemo();
        navigate(
            getClusterOnboardingRedirectPath(getCurrentDestination(location.pathname, location.search, location.hash)),
            { replace: true }
        );
    }, [clearDemo, deleteDemoMutation, location.hash, location.pathname, location.search, navigate, selectedTeamId]);

    return {
        endSession,
        isEndingSession: deleteDemoMutation.isPending
    };
};
