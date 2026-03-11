import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Paragraph from '@/shared/presentation/components/Paragraph';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import FolderBreadcrumbs from '@/shared/presentation/components/FolderBreadcrumbs';
import useFolderBreadcrumbs from '@/shared/presentation/hooks/use-folder-breadcrumbs';
import { getApiErrorMessage } from '@/shared/errors/notify-api-error';
import { Folder, FolderOpen, Home } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FolderBreadcrumbEntity } from '@/shared/presentation/hooks/use-folder-breadcrumbs';
import type { ModalFooterAction } from '@/shared/presentation/components/ModalFooterActions';

interface MoveToFolderModalProps<TFolder extends FolderBreadcrumbEntity> {
    id: string;
    itemId: string | null;
    itemName: string | null;
    itemLabel: string;
    sourceFolderId: string | null;
    listFolders: (parentId: string | null) => Promise<TFolder[]>;
    getFolder: (folderId: string) => Promise<TFolder>;
    onSubmit: (folderId: string | null) => Promise<void>;
    onClose: () => void;
};

function MoveToFolderModal<TFolder extends FolderBreadcrumbEntity>({
    id,
    itemId,
    itemName,
    itemLabel,
    sourceFolderId,
    listFolders,
    getFolder,
    onSubmit,
    onClose
}: MoveToFolderModalProps<TFolder>) {
    const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
    const [folders, setFolders] = useState<TFolder[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!itemId) {
            setActiveFolderId(null);
            setFolders([]);
            setError(null);
            setIsLoading(false);
            setIsSubmitting(false);
            setReloadKey(0);
            return;
        }

        setActiveFolderId(null);
        setError(null);
        setFolders([]);
        setIsSubmitting(false);
        setReloadKey(0);
    }, [itemId]);

    const { breadcrumbs, currentFolder } = useFolderBreadcrumbs({
        currentFolderId: activeFolderId,
        getFolder,
        onInvalidFolder: () => {
            setActiveFolderId(null);
            setReloadKey((previousValue) => previousValue + 1);
        },
        refreshKey: reloadKey
    });

    useEffect(() => {
        let isCancelled = false;

        const loadFolders = async () => {
            if (!itemId) {
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const nextFolders = await listFolders(activeFolderId);

                if (isCancelled) {
                    return;
                }

                setFolders(nextFolders);
            } catch (nextError) {
                if (isCancelled) {
                    return;
                }

                setError(getApiErrorMessage(nextError, 'Failed to load folders'));
                setFolders([]);
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            }
        };

        loadFolders();

        return () => {
            isCancelled = true;
        };
    }, [activeFolderId, itemId, listFolders, reloadKey]);

    const locationLabel = useMemo(() => {
        return currentFolder?.title ?? 'Root';
    }, [currentFolder]);

    const isCurrentDestination = sourceFolderId === activeFolderId;

    const handleClose = useCallback(() => {
        closeModal(id);
        onClose();
    }, [id, onClose]);

    const handleMove = useCallback(async () => {
        setIsSubmitting(true);

        try {
            await onSubmit(activeFolderId);
            handleClose();
        } finally {
            setIsSubmitting(false);
        }
    }, [activeFolderId, handleClose, onSubmit]);

    const handleRetry = useCallback(() => {
        setReloadKey((previousValue) => previousValue + 1);
    }, []);

    const secondaryAction: ModalFooterAction = {
        label: 'Cancel',
        onClick: handleClose,
        disabled: isSubmitting
    };

    const primaryAction: ModalFooterAction = {
        label: activeFolderId ? 'Move Here' : 'Move to Root',
        onClick: handleMove,
        disabled: isSubmitting || isCurrentDestination || !itemId,
        isLoading: isSubmitting
    };

    return (
        <Modal
            id={id}
            title={`Move ${itemLabel}`}
            description={itemName ? `Choose a destination folder for "${itemName}".` : 'Choose a destination folder.'}
            onClose={handleClose}
            footer={<ModalFooterActions primary={primaryAction} secondary={secondaryAction} />}
        >
            <Container className='d-flex column gap-1 p-1-5'>
                <FolderBreadcrumbs items={breadcrumbs} onNavigate={setActiveFolderId} />

                <Container className='d-flex items-center gap-075'>
                    {activeFolderId ? <FolderOpen size={16} /> : <Home size={16} />}
                    <Paragraph className='font-size-2 color-secondary'>Current destination: {locationLabel}</Paragraph>
                </Container>

                {isCurrentDestination && (
                    <Paragraph className='font-size-2 color-muted'>This {itemLabel.toLowerCase()} is already in this location.</Paragraph>
                )}

                <Container className='d-flex column gap-075'>
                    <Button
                        variant='soft'
                        intent='neutral'
                        block
                        align='start'
                        size='sm'
                        leftIcon={<Home size={16} />}
                        onClick={() => setActiveFolderId(null)}
                    >
                        Root
                    </Button>

                    {isLoading && (
                        <Paragraph className='font-size-2 color-muted'>Loading folders...</Paragraph>
                    )}

                    {!isLoading && error && (
                        <RecoveryState
                            title='Unable to load folders'
                            description={error}
                            tone={RecoveryStateTone.Error}
                            retryLabel='Try again'
                            onRetry={handleRetry}
                        />
                    )}

                    {!isLoading && !error && folders.length === 0 && (
                        <Paragraph className='font-size-2 color-muted'>No folders are available here.</Paragraph>
                    )}

                    {!isLoading && !error && folders.map((folder) => (
                        <Button
                            key={folder._id}
                            variant='ghost'
                            intent='neutral'
                            block
                            align='start'
                            size='sm'
                            leftIcon={<Folder size={16} />}
                            onClick={() => setActiveFolderId(folder._id)}
                        >
                            {folder.title}
                        </Button>
                    ))}
                </Container>
            </Container>
        </Modal>
    );
}

export default MoveToFolderModal;
