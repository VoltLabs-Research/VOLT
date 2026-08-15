import useTeamInvitationData from './use-team-invitation-data';
import { useCancelInvitationMutation, useSendInvitationMutation } from '@/modules/team/hooks/invitation/queries';
import type { InviteButtonState } from '@/modules/team/contracts/invite';
import { ErrorSurface } from '@/shared/contracts/errors';
import { isAccessDeniedError, reportError, resolveErrorTitle } from '@/shared/errors/core/report-error';
import { runAction } from '@/shared/ui/actions/run-action';
import { createPromiseToastOptions } from '@/shared/ui/utils/toast-options';
import type { ChangeEvent } from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { sileo } from 'sileo';
import type { TeamInviteForm } from '../../hooks/invitation/invite-panel-schema';

interface EmailFieldBind {
    value: string;
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onBlur: () => void;
    error?: string;
}

const CANCEL_INVITATION_TOAST_OPTIONS = createPromiseToastOptions({
    loading: 'Cancelling invitation...',
    success: 'Invitation cancelled',
    error: 'Failed to cancel invitation'
});

export default function useInvitePanel() {
    const [buttonState, setButtonState] = useState<InviteButtonState>('idle');
    const [cancelingId, setCancelingId] = useState<string | null>(null);
    const buttonResetTimeoutReference = useRef<number | null>(null);

    const { invitations, isLoading: loadingInvitations, teamId } = useTeamInvitationData();

    const sendInvitation = useSendInvitationMutation();
    const cancelInvitation = useCancelInvitationMutation();

    const form = useForm<TeamInviteForm>({
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

        const failWith = (message: string) => {
            form.setError('email', { message });
            setButtonState('error');
            scheduleButtonReset(2000);
        };

        const email = form.getValues().email.trim().toLowerCase();
        if (invitations.some((invitation) => invitation.email.toLowerCase() === email)) {
            failWith('Invitation already exists');
            return;
        }

        if (!teamId) {
            failWith('No team selected');
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

            failWith(resolveErrorTitle(error, 'Failed to send invitation'));
        }
    }, [form, invitations, sendInvitation, scheduleButtonReset, teamId]);

    const handleCancelInvitation = useCallback(async (invitationId: string) => {
        if (!teamId) {
            return;
        }

        setCancelingId(invitationId);
        try {
            await runAction({
                action: () => cancelInvitation.mutateAsync({
                    teamId,
                    invitationId
                }),
                toast: CANCEL_INVITATION_TOAST_OPTIONS
            });
        } finally {
            setCancelingId(null);
        }
    }, [cancelInvitation, teamId]);

    const emailField: EmailFieldBind = {
        value: form.watch('email'),
        onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
            form.setValue('email', event.target.value, { shouldValidate: true });
        },
        onBlur: () => {
            form.trigger('email');
        },
        error: form.formState.errors.email?.message
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
