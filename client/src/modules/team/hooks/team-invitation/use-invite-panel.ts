import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react';
import useZodForm from '@/shared/presentation/hooks/use-zod-form';
import useTeamInvitationData from '@/modules/team/hooks/team-invitation/use-team-invitation-data';
import { useCancelInvitationMutation, useSendInvitationMutation } from '@/modules/team/hooks/team-invitation/queries';
import { teamInviteSchema, type TeamInviteForm } from '../../components/organisms/TeamInvitePanel/validation-schema';
import type { TeamInvitation } from '@/modules/team/api/entities/team-invitation';
import type { InviteButtonState } from '../../components/atoms/InviteButton';
import ApiError from '@/shared/errors/ApiError';
import { sileo } from 'sileo';
import { showPromise } from '@/shared/presentation/hooks/toast';

interface EmailFieldBind {
    name: 'email';
    value: string;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onBlur: () => void;
    error?: string;
}

interface UseInvitePanelReturn {
    emailField: EmailFieldBind;
    handleSubmit: () => Promise<void>;
    isSubmitting: boolean;
    buttonState: InviteButtonState;
    pendingInvitations: TeamInvitation[];
    loadingInvitations: boolean;
    cancelingId: string | null;
    handleCancelInvitation: (id: string) => Promise<void>;
}

const useInvitePanel = (): UseInvitePanelReturn => {
    const [buttonState, setButtonState] = useState<InviteButtonState>('idle');
    const [cancelingId, setCancelingId] = useState<string | null>(null);
    const buttonResetTimeoutReference = useRef<ReturnType<typeof window.setTimeout> | null>(null);

    const { invitations, isLoading: loadingInvitations, teamId } = useTeamInvitationData();

    const sendInvitation = useSendInvitationMutation();
    const cancelInvitation = useCancelInvitationMutation();

    const form = useZodForm<TeamInviteForm>({
        schema: teamInviteSchema,
        defaultValues: {
            email: ''
        }
    });

    const clearButtonResetTimeout = useCallback(() => {
        if (buttonResetTimeoutReference.current === null) {
            return;
        }

        window.clearTimeout(buttonResetTimeoutReference.current);
        buttonResetTimeoutReference.current = null;
    }, []);

    const scheduleButtonReset = useCallback((delayInMilliseconds: number) => {
        clearButtonResetTimeout();
        buttonResetTimeoutReference.current = window.setTimeout(() => {
            setButtonState('idle');
            buttonResetTimeoutReference.current = null;
        }, delayInMilliseconds);
    }, [clearButtonResetTimeout]);

    useEffect(() => {
        return () => {
            clearButtonResetTimeout();
        };
    }, [clearButtonResetTimeout]);

    const handleFormSubmit = useCallback(async () => {
        const isValid = await form.trigger();
        if (!isValid) return;

        const data = form.getValues();
        const email = data.email.trim().toLowerCase();
        const existingInvitation = invitations.find((invitation) => invitation.email.toLowerCase() === email);
        if (existingInvitation) {
            form.setError('email', { message: 'Invitation already exists' });
            setButtonState('error');
            scheduleButtonReset(2000);
            return;
        }

        try {
            if (!teamId) {
                throw new Error('No team selected');
            }

            await sendInvitation.mutateAsync({
                teamId,
                email,
                roleId: undefined
            });
            sileo.success({
                title: 'Invitation sent',
                description: `Invitation sent to ${email}`
            });
            form.reset();
            setButtonState('success');
            scheduleButtonReset(2500);
        } catch (error: unknown) {
            if (ApiError.isRBACError(error)) {
                let rbacMessage = 'You do not have permission to send invitations';
                if (error instanceof ApiError) {
                    rbacMessage = error.getFriendlyMessage();
                }
                form.setError('email', { message: rbacMessage });
                sileo.error({ title: rbacMessage });
                setButtonState('error');
                scheduleButtonReset(2000);
                return;
            }
            let message = 'An unexpected error occurred';
            if (error instanceof ApiError) {
                message = error.getFriendlyMessage();
            }

            form.setError('email', { message });
            setButtonState('error');
            scheduleButtonReset(2000);
        }
    }, [form, invitations, sendInvitation, scheduleButtonReset, teamId]);

    const handleCancelInvitation = useCallback(async (invitationId: string) => {
        if (!teamId) {
            return;
        }

        setCancelingId(invitationId);
        try {
            await showPromise(cancelInvitation.mutateAsync({ teamId, invitationId }), {
                loading: { title: 'Cancelling invitation...' },
                success: { title: 'Invitation cancelled' },
                error: { title: 'Failed to cancel invitation' }
            });
        } finally {
            setCancelingId(null);
        }
    }, [cancelInvitation, teamId]);

    const emailValue = form.watch('email');
    const emailError = form.formState.errors.email?.message;

    const emailField: EmailFieldBind = {
        name: 'email',
        value: emailValue,
        onChange: (event: ChangeEvent<HTMLInputElement>) => {
            form.setValue('email', event.target.value, { shouldValidate: true });
        },
        onBlur: () => {
            form.trigger('email');
        },
        error: emailError
    };

    return {
        emailField,
        handleSubmit: handleFormSubmit,
        isSubmitting: form.formState.isSubmitting,
        buttonState,
        pendingInvitations: invitations,
        loadingInvitations,
        cancelingId,
        handleCancelInvitation
    };
};

export default useInvitePanel;
