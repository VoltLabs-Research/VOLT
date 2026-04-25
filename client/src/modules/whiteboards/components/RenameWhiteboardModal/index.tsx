import { RENAME_WHITEBOARD_MODAL_ID } from '@/modules/whiteboards/hooks/use-whiteboards-listing';
import { getSafeWhiteboardTitle } from '@/modules/whiteboards/utilities/whiteboards';
import RenameEntityModal from '@/shared/presentation/components/RenameEntityModal';
import type { Whiteboard } from '@/modules/whiteboards/api/entities/whiteboard';

interface RenameWhiteboardModalProps {
    whiteboard: Whiteboard | null;
    onSubmit: (title: string) => Promise<void>;
    onClose: () => void;
};

const getInitialWhiteboardTitle = (whiteboard: Whiteboard): string => {
    return getSafeWhiteboardTitle(whiteboard.title);
};

const validateWhiteboardTitle = (title: string): string | undefined => {
    return title.length > 120 ? 'Title must be 120 characters or less' : undefined;
};

const RenameWhiteboardModal = ({
    whiteboard,
    onSubmit,
    onClose
}: RenameWhiteboardModalProps) => {
    return (
        <RenameEntityModal
            entity={whiteboard}
            modalId={RENAME_WHITEBOARD_MODAL_ID}
            title='Rename Whiteboard'
            description='Enter a new name for this whiteboard.'
            fieldLabel='Whiteboard title'
            placeholder='Enter whiteboard title'
            getInitialTitle={getInitialWhiteboardTitle}
            validateTitle={validateWhiteboardTitle}
            onSubmit={onSubmit}
            onClose={onClose}
        />
    );
};

export default RenameWhiteboardModal;
