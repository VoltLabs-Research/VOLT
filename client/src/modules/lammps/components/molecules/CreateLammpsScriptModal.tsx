import { ErrorSurface, reportError } from '@/shared/errors/core';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Paragraph from '@/shared/presentation/components/Paragraph';
import type { SelectOption } from '@/shared/presentation/components/Select';
import type { LammpsContainer } from '@/modules/lammps/api/types';
import { useCallback, useMemo, useState } from 'react';
import type { ModalFooterAction } from '@/shared/presentation/components/ModalFooterActions';

interface CreateLammpsScriptModalProps {
    id: string;
    teamId: string | null;
    containers: LammpsContainer[];
    onSubmit: (payload: { title: string; containerId: string }) => Promise<void>;
}

const CreateLammpsScriptModal = ({
    id,
    teamId,
    containers,
    onSubmit
}: CreateLammpsScriptModalProps) => {
    const containerOptions = useMemo<SelectOption[]>(() => {
        return containers
            .filter((container) => container.status === 'ready')
            .map((container) => ({
                value: container._id,
                title: container.name,
                description: Array.isArray(container.packages) && container.packages.length > 0
                    ? `${container.packages.length} package${container.packages.length === 1 ? '' : 's'}`
                    : 'Default runtime'
            }));
    }, [containers]);

    const [title, setTitle] = useState('');
    const [containerId, setContainerId] = useState<string | null>(containerOptions[0]?.value ?? null);
    const [error, setError] = useState<string | undefined>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleRequestClose = useCallback(() => {
        closeModal(id);
    }, [id]);

    const handleModalClose = useCallback(() => {
        setTitle('');
        setContainerId(containerOptions[0]?.value ?? null);
        setError(undefined);
        setIsSubmitting(false);
    }, [containerOptions]);

    const handleSubmit = useCallback(async () => {
        if (!teamId) {
            return;
        }

        if (!title.trim()) {
            setError('Script title is required.');
            return;
        }

        if (!containerId) {
            setError('Select a ready LAMMPS container.');
            return;
        }

        setIsSubmitting(true);
        setError(undefined);

        try {
            await onSubmit({
                title: title.trim(),
                containerId
            });
            handleRequestClose();
        } catch (nextError) {
            const userError = reportError(nextError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Failed to create script'
            });
            setError(userError.description ?? userError.title);
        } finally {
            setIsSubmitting(false);
        }
    }, [containerId, handleRequestClose, onSubmit, teamId, title]);

    const secondaryAction: ModalFooterAction = {
        label: 'Cancel',
        onClick: handleRequestClose,
        disabled: isSubmitting
    };

    const primaryAction: ModalFooterAction = {
        label: 'Create Script',
        onClick: () => {
            void handleSubmit();
        },
        disabled: isSubmitting || !title.trim() || !containerId,
        isLoading: isSubmitting
    };

    return (
        <Modal
            id={id}
            title='Create LAMMPS Script'
            description='Create a collaborative script workspace bound to one of your ready LAMMPS containers.'
            onClose={handleModalClose}
            footer={<ModalFooterActions primary={primaryAction} secondary={secondaryAction} />}
        >
            <Container className='d-flex column gap-1 p-1-5'>
                <FormFieldRHF
                    label='Script title'
                    placeholder='For example: vacancy-relaxation'
                    value={title}
                    onChange={(event) => {
                        setTitle(event.target.value);
                        setError(undefined);
                    }}
                    error={error}
                />

                <FormFieldRHF
                    label='Container'
                    fieldType='select'
                    options={containerOptions}
                    value={containerId ?? ''}
                    onChange={(event) => {
                        setContainerId(event.target.value);
                        setError(undefined);
                    }}
                    error={error}
                    disabled={containerOptions.length === 0}
                />

                {containerOptions.length === 0 && (
                    <Paragraph className='font-size-2 color-muted'>
                        You need at least one ready LAMMPS container before creating scripts.
                    </Paragraph>
                )}
            </Container>
        </Modal>
    );
};

export default CreateLammpsScriptModal;
