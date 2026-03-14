import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Container from '@/shared/presentation/components/Container';
import { RENAME_WHITEBOARD_MODAL_ID } from '@/modules/whiteboards/hooks/use-whiteboards-listing';
import { getSafeWhiteboardTitle } from '@/modules/whiteboards/utilities/whiteboards';
import { useCallback, useEffect, useState } from 'react';
import type { ModalFooterAction } from '@/shared/presentation/components/ModalFooterActions';
import type { Whiteboard } from '@/modules/whiteboards/api/entities/whiteboard';

interface RenameWhiteboardModalProps {
    whiteboard: Whiteboard | null;
    onSubmit: (title: string) => Promise<void>;
    onClose: () => void;
};

const RenameWhiteboardModal = ({
    whiteboard,
    onSubmit,
    onClose
}: RenameWhiteboardModalProps) => {
    const [title, setTitle] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | undefined>();

    useEffect(() => {
        if (whiteboard) {
            setTitle(getSafeWhiteboardTitle(whiteboard.title));
            setError(undefined);
        }
    }, [whiteboard]);

    const handleClose = useCallback(() => {
        closeModal(RENAME_WHITEBOARD_MODAL_ID);
        onClose();
    }, [onClose]);

    const handleSubmit = useCallback(async () => {
        const trimmed = title.trim();
        if (!trimmed) {
            setError('Title is required');
            return;
        }

        if (trimmed.length > 120) {
            setError('Title must be 120 characters or less');
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit(trimmed);
        } finally {
            setIsSubmitting(false);
        }
    }, [title, onSubmit]);

    const handleTitleChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setTitle(event.target.value);
        setError(undefined);
    }, []);

    const inputProps: React.InputHTMLAttributes<HTMLInputElement> = {
        onKeyDown: (event) => {
            if (event.key === 'Enter') {
                handleSubmit();
            }
        }
    };

    const primaryAction: ModalFooterAction = {
        label: 'Rename',
        onClick: handleSubmit,
        disabled: isSubmitting || !title.trim()
    };

    const secondaryAction: ModalFooterAction = {
        label: 'Cancel',
        onClick: handleClose,
        disabled: isSubmitting
    };

    const footer = <ModalFooterActions primary={primaryAction} secondary={secondaryAction} />;

    return (
        <Modal
            id={RENAME_WHITEBOARD_MODAL_ID}
            title='Rename Whiteboard'
            description='Enter a new name for this whiteboard.'
            onClose={handleClose}
            footer={footer}
        >
            <Container className='p-1-5'>
                <FormFieldRHF
                    label='Whiteboard title'
                    placeholder='Enter whiteboard title'
                    autoFocus
                    value={title}
                    onChange={handleTitleChange}
                    inputProps={inputProps}
                    error={error}
                />
            </Container>
        </Modal>
    );
};

export default RenameWhiteboardModal;
