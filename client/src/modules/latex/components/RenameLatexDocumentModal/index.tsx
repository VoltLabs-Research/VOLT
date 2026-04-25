import { RENAME_LATEX_DOCUMENT_MODAL_ID } from '@/modules/latex/hooks/use-latex-documents-listing';
import RenameEntityModal from '@/shared/presentation/components/RenameEntityModal';
import type { LatexDocument } from '@/modules/latex/api/entities/latex-document';

interface RenameLatexDocumentModalProps {
    document: LatexDocument | null;
    onSubmit: (title: string) => Promise<void>;
    onClose: () => void;
};

const getLatexDocumentTitle = (document: LatexDocument): string => document.title;

const RenameLatexDocumentModal = ({ document, onSubmit, onClose }: RenameLatexDocumentModalProps) => {
    return (
        <RenameEntityModal
            entity={document}
            modalId={RENAME_LATEX_DOCUMENT_MODAL_ID}
            title='Rename Document'
            description='Enter a new name for this LaTeX document.'
            fieldLabel='Document title'
            placeholder='Enter document title'
            getInitialTitle={getLatexDocumentTitle}
            onSubmit={onSubmit}
            onClose={onClose}
        />
    );
};

export default RenameLatexDocumentModal;
