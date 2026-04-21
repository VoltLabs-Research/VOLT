import useTeamInvitationData from '@/modules/team/hooks/invitation/use-team-invitation-data';
import { useCancelInvitationMutation, useSendInvitationMutation } from '@/modules/team/hooks/invitation/queries';
import type { TeamInvitation } from '@/modules/team/api/entities/invitation/team-invitation';
import type { InviteButtonState } from '../../components/InviteButton';
import { ErrorSurface, getErrorMessage, isAccessDeniedError, isApiError, reportError } from '@/shared/errors/core';
import { runAction } from '@/shared/presentation/actions/run-action';
import { zodResolver } from '@hookform/resolvers/zod';
import { createPromiseToastOptions } from '@/shared/presentation/toast-options';
import type { ChangeEvent } from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { sileo } from 'sileo';
import { teamInviteSchema } from './invite-panel-schema';
import type { TeamInviteForm } from './invite-panel-schema';

interface EmailFieldBind {
    name: 'email';
    value: string;
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onBlur: () => void;
    error?: string;
};

interface UseInvitePanelReturn {
    emailField: EmailFieldBind;
    handleSubmit: () => Promise<void>;
    isSubmitting: boolean;
    buttonState: InviteButtonState;
    pendingInvitations: TeamInvitation[];
    loadingInvitations: boolean;
    cancelingId: string | null;
    handleCancelInvitation: (id: string) => Promise<void>;
};

const CANCEL_INVITATION_TOAST_OPTIONS = createPromiseToastOptions({
    loading: 'Cancelling invitation...',
    success: 'Invitation cancelled',
    error: 'Failed to cancel invitation'
});

export default function useInvitePanel(): UseInvitePanelReturn {
    const [buttonState, setButtonState] = useState<InviteButtonState>('idle');
    const [cancelingId, setCancelingId] = useState<string | null>(null);
    const buttonResetTimeoutReference = useRef<number | null>(null);

    const { invitations, isLoading: loadingInvitations, teamId } = useTeamInvitationData();

    const sendInvitation = useSendInvitationMutation();
    const cancelInvitation = useCancelInvitationMutation();

    const form = useForm<TeamInviteForm>({
        resolver: zodResolver(teamInviteSchema),
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

        if (!teamId) {
            form.setError('email', { message: 'No team selected' });
            setButtonState('error');
            scheduleButtonReset(2000);
            return;
        }

        try {
            await runAction({
                action: () => sendInvitation.mutateAsync({
                    teamId,
                    email,
                    roleId: undefined
                }),
                afterSuccess: () => {
                    sileo.success({
                        title: 'Invitation sent',
                        description: `Invitation sent to ${email}`
                    });
                    form.reset();
                    setButtonState('success');
                    scheduleButtonReset(2500);
                }
            });
        } catch (error: unknown) {
            if (isAccessDeniedError(error)) {
                reportError(error, {
                    surface: ErrorSurface.Toast,
                    fallbackTitle: 'You do not have permission to send invitations'
                });
            }

            form.setError('email', {
                message: isApiError(error)
                    ? getErrorMessage(error.code, 'Failed to send invitation')
                    : error instanceof Error && error.message.trim().length > 0
                        ? error.message
                        : 'Failed to send invitation'
            });
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
            await runAction({
                action: () => cancelInvitation.mutateAsync({ teamId, invitationId }),
                toast: CANCEL_INVITATION_TOAST_OPTIONS
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
        onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
}
