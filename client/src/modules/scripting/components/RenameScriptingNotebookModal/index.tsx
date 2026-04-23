import { Modal, closeModal } from '@/shared/presentation/primitives';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import { Text } from '@/shared/presentation/primitives';
import { RENAME_SCRIPTING_NOTEBOOK_MODAL_ID } from '@/modules/scripting/hooks/use-notebooks-listing';
import { useCallback, useEffect, useState } from 'react';
import type { ModalFooterAction } from '@/shared/presentation/components/ModalFooterActions';
import type { FormEvent } from 'react';
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
            setTitle(notebook.title || '');
            setError(undefined);
        }
    }, [notebook]);

    const trimmedTitle = title.trim();
    const currentTitle = notebook?.title.trim() || '';
    const isUnchanged = trimmedTitle.length > 0 && trimmedTitle === currentTitle;

    const handleClose = useCallback(() => {
        closeModal(RENAME_SCRIPTING_NOTEBOOK_MODAL_ID);
        onClose();
    }, [onClose]);

    const handleSubmit = useCallback(async () => {
        if (!trimmedTitle) {
            setError('Title is required');
            return;
        }

        if (isUnchanged) {
            setError('Enter a different notebook name.');
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit(trimmedTitle);
        } finally {
            setIsSubmitting(false);
        }
    }, [isUnchanged, onSubmit, trimmedTitle]);

    const handleTitleChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setTitle(event.target.value);
        setError(undefined);
    }, []);

    const handleFormSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        handleSubmit();
    }, [handleSubmit]);

    const inputProps: React.InputHTMLAttributes<HTMLInputElement> = {
        autoComplete: 'off',
        enterKeyHint: 'done',
        maxLength: 120,
        spellCheck: false,
        onKeyDown: (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleSubmit();
            }
        }
    };

    const primaryAction: ModalFooterAction = {
        label: isSubmitting ? 'Renaming...' : 'Rename',
        onClick: handleSubmit,
        disabled: isSubmitting || !trimmedTitle || isUnchanged
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
            description='Choose a clear notebook name so it is easier to find later.'
            onClose={handleClose}
            footer={footer}
        >
            <form className='p-1-5 d-flex column gap-075' onSubmit={handleFormSubmit}>
                {notebook && (
                    <Text as='p' size='sm' tone='secondary' truncate>
                        Current name: {notebook.title || 'Untitled notebook'}
                    </Text>
                )}
                <FormFieldRHF
                    label='Notebook title'
                    placeholder='Enter notebook title'
                    autoFocus
                    value={title}
                    onChange={handleTitleChange}
                    inputProps={inputProps}
                    error={error}
                />
                <Text as='p' size='sm' tone='muted'>
                    Use up to 120 characters.
                </Text>
            </form>
        </Modal>
    );
};

export default RenameScriptingNotebookModal;
