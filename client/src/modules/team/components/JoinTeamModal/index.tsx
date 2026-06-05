import { useJoinByCodeMutation } from '@/modules/team/hooks/team/queries';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import { runAction } from '@/shared/presentation/actions/run-action';
import { useState } from 'react';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Modal, { resetModal } from '@/shared/presentation/primitives/Modal';
import Text from '@/shared/presentation/primitives/Text';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { joinTeamSchema } from './validation-schema';
import type { JoinByInviteCodeOutputDTO } from '@/modules/team/api/services/team-service';
import type { JoinTeamForm } from './validation-schema';

const MODAL_ID = 'join-team-modal';
const JOIN_TEAM_FORM_ID = 'join-team-form';

interface JoinTeamModalProps {
    onSuccess?: (result: JoinByInviteCodeOutputDTO) => void | Promise<void>;
    onClose?: () => void;
}

export const JoinTeamModal = ({
    onSuccess,
    onClose
}: JoinTeamModalProps) => {
    const [apiError, setApiError] = useState<string | null>(null);

    const joinByCodeMutation = useJoinByCodeMutation();

    const form = useForm<JoinTeamForm>({
        resolver: zodResolver(joinTeamSchema),
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
                        onClick: closeJoinTeamModal,
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
                    <Text as='p' size='md' className='team-creator-error radius-sm'>
                        {apiError}
                    </Text>
                )}
            </form>
        </Modal>
    );
};
