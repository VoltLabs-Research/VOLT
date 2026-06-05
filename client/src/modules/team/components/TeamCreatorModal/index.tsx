import { useCreateTeamMutation } from '@/modules/team/hooks/team/queries';
import { useTeamStore } from '@/modules/team/stores/team/use-team-store';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import { runAction } from '@/shared/presentation/actions/run-action';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Modal, { resetModal } from '@/shared/presentation/primitives/Modal';
import Text from '@/shared/presentation/primitives/Text';
import { zodResolver } from '@hookform/resolvers/zod';
import { createPromiseToastOptions } from '@/shared/presentation/toast-options';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { teamCreatorSchema } from './validation-schema';
import type { TeamCreatorForm } from './validation-schema';
import './TeamCreatorModal.css';

const MODAL_ID = 'team-creator-modal';
const TEAM_CREATOR_FORM_ID = 'team-creator-form';

interface TeamCreatorModalProps {
    isRequired?: boolean;
    onSuccess?: () => void;
    onClose?: () => void;
}

const TEAM_CREATOR_TOAST_OPTIONS = createPromiseToastOptions({
    loading: 'Creating team...',
    success: 'Team created successfully',
    error: 'Failed to create team'
});

export const TeamCreatorModal = ({
    isRequired = false,
    onSuccess,
    onClose
}: TeamCreatorModalProps) => {
    const [apiError, setApiError] = useState<string | null>(null);

    const createTeamMutation = useCreateTeamMutation();
    const setSelectedTeamId = useTeamStore((state) => state.setSelectedTeamId);

    const form = useForm<TeamCreatorForm>({
        resolver: zodResolver(teamCreatorSchema) as unknown as Resolver<TeamCreatorForm>,
        defaultValues: {
            name: '',
            description: ''
        }
    });

    const nameValue = form.watch('name');

    const closeTeamCreatorModal = () => {
        resetModal(MODAL_ID, () => {
            form.reset();
            setApiError(null);
            onClose?.();
        });
    };

    const onSubmit = async (data: TeamCreatorForm) => {
        setApiError(null);
        try {
            await runAction({
                action: () => createTeamMutation.mutateAsync({
                    name: data.name.trim(),
                    description: data.description?.trim() || ''
                }),
                toast: TEAM_CREATOR_TOAST_OPTIONS,
                afterSuccess: (team) => {
                    setSelectedTeamId(team._id);
                    closeTeamCreatorModal();
                    onSuccess?.();
                }
            });
        } catch (error: unknown) {
            setApiError(reportError(error, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Failed to create team'
            }).title);
        }
    };

    const handleClose = () => {
        if (isRequired) return;
        closeTeamCreatorModal();
    };

    return (
        <Modal
            id={MODAL_ID}
            title='Create Team'
            description='Create a new workspace for your trajectories.'
            width='450px'
            footer={(
                <ModalFooterActions
                    secondary={!isRequired ? {
                        label: 'Cancel',
                        onClick: handleClose,
                        disabled: form.formState.isSubmitting
                    } : undefined}
                    primary={{
                        label: 'Create Team',
                        type: 'submit',
                        form: TEAM_CREATOR_FORM_ID,
                        isLoading: form.formState.isSubmitting,
                        disabled: !nameValue.trim() || form.formState.isSubmitting
                    }}
                />
            )}
        >
            <form id={TEAM_CREATOR_FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className='d-flex column gap-1-5 p-1-5'>
                <FormFieldRHF
                    name='name'
                    control={form.control}
                    label='Team Name'
                    placeholder='Ex. My Research Group'
                    disabled={form.formState.isSubmitting}
                    autoFocus
                />

                <FormFieldRHF
                    name='description'
                    control={form.control}
                    label='Description (Optional)'
                    placeholder='What is this team for?'
                    disabled={form.formState.isSubmitting}
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
