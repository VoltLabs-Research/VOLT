import { useState, useEffect, useCallback } from 'react';
import useForm from '@/shared/presentation/hooks/use-form';
import useTeamInvitationUseCases from '@/modules/team/presentation/hooks/team-invitation/use-team-invitation-use-cases';
import { useTeamInvitationStore } from '@/modules/team/presentation/stores/use-team-invitation-store';
import useTeamInvitationData from '@/modules/team/presentation/hooks/team-invitation/use-team-invitation-data';
import { teamInviteSchema, TeamInviteForm } from '../../components/organisms/TeamInvitePanel/validation-schema';
import type { TeamInvitation } from '@/modules/team/domain/entities/TeamInvitation';
import type { InviteButtonState } from '../../components/atoms/InviteButton';
import { FieldBind } from '@/shared/presentation/hooks/use-form';

interface UseInvitePanelOptions{
    teamId: string;
};

interface UseInvitePanelReturn{
    emailField: FieldBind<TeamInviteForm, 'email'>;
    handleSubmit: () => void;
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
    const pendingInvitations = useTeamInvitationStore((state) => state.pendingInvitations);
    const removeInvitation = useTeamInvitationStore((state) => state.removeInvitation);

    const { fetchPendingInvitations } = useTeamInvitationData();

    const { field, handleSubmit: formHandleSubmit, isSubmitting, reset } = useForm<TeamInviteForm>({
        initialValues: {
            email: ''
        },
        schema: teamInviteSchema,
        onSubmit: async (data) => {
            const existingInvitation = pendingInvitations.find(inv => inv.email === data.email.trim());
            if(existingInvitation){
                setButtonState('error');
                setTimeout(() => setButtonState('idle'), 2000);
                throw new Error('Invitation already exists');
            }

            try{
                await teamInvitationRepository.send(data.email, 'Can view');
                await fetchPendingInvitations();
                reset();
                setButtonState('success');
                setTimeout(() => setButtonState('idle'), 2500);
            }catch(error){
                setButtonState('error');
                setTimeout(() => setButtonState('idle'), 2000);
                throw error;
            }
        }
    });

    const loadInvitations = useCallback(async () => {
        if(!teamId) return;

        setLoadingInvitations(true);
        try{
            await fetchPendingInvitations();
        }catch(error){
            console.error('Error fetching pending invitations:', error);
        }finally{
            setLoadingInvitations(false);
        }
    }, [teamId, fetchPendingInvitations]);

    useEffect(() => {
        loadInvitations();
    }, [loadInvitations]);

    const handleCancelInvitation = useCallback(async (invitationId: string) => {
        setCancelingId(invitationId);
        try{
            await teamInvitationRepository.cancel(invitationId);
            removeInvitation(invitationId);
        }catch(error){
            console.error('Failed to cancel invitation:', error);
        }finally{
            setCancelingId(null);
        }
    }, [teamInvitationRepository, removeInvitation]);

    const emailField = field('email');

    return {
        emailField,
        handleSubmit: formHandleSubmit(),
        isSubmitting,
        buttonState,
        pendingInvitations,
        loadingInvitations,
        cancelingId,
        handleCancelInvitation
    };
};

export default useInvitePanel;
