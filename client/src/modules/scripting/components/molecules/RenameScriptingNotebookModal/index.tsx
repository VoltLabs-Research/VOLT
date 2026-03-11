import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Container from '@/shared/presentation/components/Container';
import { RENAME_SCRIPTING_NOTEBOOK_MODAL_ID } from '@/modules/scripting/hooks/use-notebooks-listing';
import { useCallback, useEffect, useState } from 'react';
import type { ModalFooterAction } from '@/shared/presentation/components/ModalFooterActions';
import type { ScriptingNotebook } from '@/modules/scripting/api/entities/scripting-notebook';

interface RenameScriptingNotebookModalProps {
    notebook: ScriptingNotebook | null;
    onSubmit: (title: string) => Promise<void>;
    onClose: () => void;
};

const RenameScriptingNotebookModal = ({
    notebook,
    onSubmit,
    onClose
}: RenameScriptingNotebookModalProps) => {
    const [title, setTitle] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | undefined>();

    useEffect(() => {
        if (notebook) {
            setTitle(notebook.title);
            setError(undefined);
        }
    }, [notebook]);

    const handleClose = useCallback(() => {
        closeModal(RENAME_SCRIPTING_NOTEBOOK_MODAL_ID);
        onClose();
    }, [onClose]);

    const handleSubmit = useCallback(async () => {
        const trimmed = title.trim();
        if (!trimmed) {
            setError('Title is required');
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
            id={RENAME_SCRIPTING_NOTEBOOK_MODAL_ID}
            title='Rename Notebook'
            description='Enter a new name for this notebook.'
            onClose={handleClose}
            footer={footer}
        >
            <Container className='p-1-5'>
                <FormFieldRHF
                    label='Notebook title'
                    placeholder='Enter notebook title'
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

export default RenameScriptingNotebookModal;
