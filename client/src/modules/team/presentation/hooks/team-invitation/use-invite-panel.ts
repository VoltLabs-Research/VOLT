import { useState, useEffect, useCallback } from 'react';
import useForm from '@/shared/presentation/hooks/use-form';
import useTeamInvitationUseCases from '@/modules/team/presentation/hooks/team-invitation/use-team-invitation-use-cases';
import { useTeamInvitationStore } from '@/modules/team/presentation/stores/use-team-invitation-store';
import useTeamInvitationData from '@/modules/team/presentation/hooks/team-invitation/use-team-invitation-data';
import { teamInviteSchema, TeamInviteForm } from '../../components/organisms/TeamInvitePanel/validation-schema';
import type { TeamInvitation } from '@/modules/team/domain/entities/TeamInvitation';
import type { InviteButtonState } from '../../components/atoms/InviteButton';
import { FieldBind } from '@/shared/presentation/hooks/use-form';
import ApiError from '@/shared/errors/ApiError';
import useAsyncAction from '@/shared/presentation/hooks/use-async-action';

interface UseInvitePanelOptions{
    teamId: string;
};

interface UseInvitePanelReturn{
    emailField: FieldBind<TeamInviteForm, 'email'>;
    handleSubmit: () => Promise<void>;
    isSubmitting: boolean;
    buttonState: InviteButtonState;
    pendingInvitations: TeamInvitation[];
    loadingInvitations: boolean;
    cancelingId: string | null;
    handleCancelInvitation: (id: string) => Promise<void>;
};

const useInvitePanel = ({ teamId }: UseInvitePanelOptions): UseInvitePanelReturn => {
    const [buttonState, setButtonState] = useState<InviteButtonState>('idle');
    const [loadingInvitations, setLoadingInvitations] = useState(true);
    const [cancelingId, setCancelingId] = useState<string | null>(null);

    const { teamInvitationRepository } = useTeamInvitationUseCases();
    const invitations = useTeamInvitationStore((state) => state.invitations);
    const removeInvitation = useTeamInvitationStore((state) => state.removeInvitation);

    const { fetchPendingInvitations } = useTeamInvitationData();

    const loadInvitationsAction = useAsyncAction({
        onError: (error: unknown) => {
            console.error('Error fetching pending invitations:', error);
        },
        onFinally: () => setLoadingInvitations(false)
    });

    const cancelInvitationAction = useAsyncAction({
        onError: (error: unknown) => {
            console.error('Failed to cancel invitation:', error);
        },
        onFinally: () => setCancelingId(null)
    });

    const { field, handleSubmit: formHandleSubmit, isSubmitting, reset, setErrors } = useForm<TeamInviteForm>({
        initialValues: {
            email: ''
        },
        schema: teamInviteSchema,
        onSubmit: async (data) => {
            const email = data.email.trim().toLowerCase();
            const existingInvitation = invitations.find(inv => inv.email.toLowerCase() === email);
            if(existingInvitation){
                setErrors({ email: 'Invitation already exists' });
                setButtonState('error');
                setTimeout(() => setButtonState('idle'), 2000);
                return;
            }

            try{
                await teamInvitationRepository.send(email, 'Can view');
                await fetchPendingInvitations();
                reset();
                setErrors({});
                setButtonState('success');
                setTimeout(() => setButtonState('idle'), 2500);
            }catch(error){
                const message = error instanceof ApiError
                    ? error.getFriendlyMessage()
                    : 'An unexpected error occurred';

                setErrors({ email: message });
                setButtonState('error');
                setTimeout(() => setButtonState('idle'), 2000);
            }
        }
    });

    const loadInvitations = useCallback(async () => {
        if(!teamId) return;

        setLoadingInvitations(true);
        await loadInvitationsAction.execute(async () => {
            await fetchPendingInvitations();
        });
    }, [teamId, fetchPendingInvitations, loadInvitationsAction]);

    useEffect(() => {
        loadInvitations();
    }, [loadInvitations]);

    const handleCancelInvitation = useCallback(async (invitationId: string) => {
        setCancelingId(invitationId);
        await cancelInvitationAction.execute(async () => {
            await teamInvitationRepository.cancel(invitationId);
            removeInvitation(invitationId);
        });
    }, [teamInvitationRepository, removeInvitation, cancelInvitationAction]);

    const emailField = field('email');

    return {
        emailField,
        handleSubmit: formHandleSubmit(),
        isSubmitting,
        buttonState,
        pendingInvitations: invitations,
        loadingInvitations,
        cancelingId,
        handleCancelInvitation
    };
};

export default useInvitePanel;
