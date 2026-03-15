import { useJoinByCodeMutation } from '@/modules/team/hooks/team/queries';
import { normalizeError } from '@/shared/errors/core';
import { runAction } from '@/shared/presentation/actions/run-action';
import { useState } from 'react';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Modal from '@/shared/presentation/components/Modal';
import useModalForm from '@/shared/presentation/hooks/use-modal-form';
import useZodForm from '@/shared/presentation/hooks/use-zod-form';
import { joinTeamSchema } from './validation-schema';
import type { JoinByInviteCodeOutputDTO } from '@/modules/team/api/dtos/team/join-by-invite-code';
import type { JoinTeamForm } from './validation-schema';

const MODAL_ID = 'join-team-modal';
const JOIN_TEAM_FORM_ID = 'join-team-form';

interface JoinTeamModalProps {
    onSuccess?: (result: JoinByInviteCodeOutputDTO) => void | Promise<void>;
    onClose?: () => void;
};

export const JoinTeamModal = ({
    onSuccess,
    onClose
}: JoinTeamModalProps) => {
    const [apiError, setApiError] = useState<string | null>(null);

    const joinByCodeMutation = useJoinByCodeMutation();

    const form = useZodForm<JoinTeamForm>({
        schema: joinTeamSchema,
        defaultValues: {
            code: ''
        }
    });

    const codeValue = form.watch('code');

    const modalForm = useModalForm({
        modalId: MODAL_ID,
        reset: () => {
            form.reset();
            setApiError(null);
        },
        onAfterClose: onClose
    });

    const onSubmit = async (data: JoinTeamForm) => {
        setApiError(null);
        try {
            await runAction({
                action: () => joinByCodeMutation.mutateAsync({ code: data.code }),
                afterSuccess: async (result) => {
                    modalForm.close();
                    await onSuccess?.(result);
                }
            });
        } catch (error: unknown) {
            setApiError(normalizeError(error).friendlyMessage || 'Invalid invite code. Please check and try again.');
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
                        onClick: () => modalForm.close(),
                        disabled: form.formState.isSubmitting
                    }}
                    primary={{
                        label: 'Join Team',
                        type: 'submit',
                        form: JOIN_TEAM_FORM_ID,
                        isLoading: form.formState.isSubmitting,
                        disabled: codeValue.length !== 5 || form.formState.isSubmitting
                    }}
                />
            )}
        >
            <form
                id={JOIN_TEAM_FORM_ID}
                onSubmit={form.handleSubmit(onSubmit)}
                className='d-flex column gap-1-5 p-1-5'
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
                    <Container className='team-creator-error radius-sm font-size-2'>
                        {apiError}
                    </Container>
                )}
            </form>
        </Modal>
    );
};
