import { useJoinByCodeMutation } from '@/modules/team/hooks/team/queries';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import { runAction } from '@/shared/ui/actions/run-action';
import { useState } from 'react';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import ModalFooterActions from '@/shared/ui/components/ModalFooterActions';
import { Modal, resetModal } from '@/shared/ui/modal';
import { useForm } from 'react-hook-form';
import type { JoinByInviteCodeResponse } from '@/modules/team/api/services/team-service';
import type { JoinTeamForm } from './validation-schema';

const MODAL_ID = 'join-team-modal';
const JOIN_TEAM_FORM_ID = 'join-team-form';

interface JoinTeamModalProps {
    onSuccess?: (result: JoinByInviteCodeResponse) => void | Promise<void>;
    onClose?: () => void;
}

export const JoinTeamModal = ({
    onSuccess,
    onClose
}: JoinTeamModalProps) => {
    const [apiError, setApiError] = useState<string | null>(null);

    const joinByCodeMutation = useJoinByCodeMutation();

    const form = useForm<JoinTeamForm>({
        defaultValues: {
            code: ''
        }
    });

    const codeValue = form.watch('code');

    const closeJoinTeamModal = () => {
        resetModal(MODAL_ID, () => {
            form.reset();
            setApiError(null);
            onClose?.();
        });
    };

    const onSubmit = async (data: JoinTeamForm) => {
        setApiError(null);
        try {
            await runAction({
                action: () => joinByCodeMutation.mutateAsync({ code: data.code }),
                afterSuccess: async (result) => {
                    closeJoinTeamModal();
                    await onSuccess?.(result);
                }
            });
        } catch (error: unknown) {
            setApiError(reportError(error, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Invalid invite code. Please check and try again.'
            }).title);
        }
    };

    return (
        <Modal
            id={MODAL_ID}
            title='Join a Team'
            description='Enter the 5-character invite code to join a team.'
            width='400px'
            footer={(
                <ModalFooterActions
                    secondary={{
                        label: 'Cancel',
                        onPress: closeJoinTeamModal,
                        isDisabled: form.formState.isSubmitting
                    }}
                    primary={{
                        label: 'Join Team',
                        type: 'submit',
                        form: JOIN_TEAM_FORM_ID,
                        isPending: form.formState.isSubmitting,
                        isDisabled: codeValue.length !== 5 || form.formState.isSubmitting
                    }}
                />
            )}
        >
            <form
                id={JOIN_TEAM_FORM_ID}
                onSubmit={form.handleSubmit(onSubmit)}
                className='flex flex-col gap-6 p-6'
            >
                <FormFieldRHF
                    name='code'
                    control={form.control}
                    label='Invite Code'
                    placeholder='Ex. AB1C2'
                    disabled={form.formState.isSubmitting}
                    autoFocus
                />

                {apiError && (
                    <p className='text-sm text-danger px-3 py-2 bg-danger-soft rounded-lg'>
                        {apiError}
                    </p>
                )}
            </form>
        </Modal>
    );
};
