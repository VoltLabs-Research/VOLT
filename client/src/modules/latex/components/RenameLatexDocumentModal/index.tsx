import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import { RENAME_LATEX_DOCUMENT_MODAL_ID } from '@/modules/latex/hooks/use-latex-documents-listing';
import { useCallback, useEffect, useState } from 'react';
import type { ModalFooterAction } from '@/shared/presentation/components/ModalFooterActions';
import type { LatexDocument } from '@/modules/latex/api/entities/latex-document';

interface RenameLatexDocumentModalProps {
    document: LatexDocument | null;
    onSubmit: (title: string) => Promise<void>;
    onClose: () => void;
};

const RenameLatexDocumentModal = ({ document, onSubmit, onClose }: RenameLatexDocumentModalProps) => {
    const [title, setTitle] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | undefined>();

    useEffect(() => {
        if (document) {
            setTitle(document.title);
            setError(undefined);
        }
    }, [document]);

    const handleClose = useCallback(() => {
        closeModal(RENAME_LATEX_DOCUMENT_MODAL_ID);
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
            id={RENAME_LATEX_DOCUMENT_MODAL_ID}
            title='Rename Document'
            description='Enter a new name for this LaTeX document.'
            onClose={handleClose}
            footer={footer}
        >
            <div className='volt-container p-1-5'>
                <FormFieldRHF
                    label='Document title'
                    placeholder='Enter document title'
                    autoFocus
                    value={title}
                    onChange={handleTitleChange}
                    inputProps={inputProps}
                    error={error}
                />
            </div>
        </Modal>
    );
};

export default RenameLatexDocumentModal;
