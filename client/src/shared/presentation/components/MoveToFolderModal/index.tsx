import { ErrorSurface, reportError } from '@/shared/errors/core';
import { Button, Modal, closeModal, Row, Stack, Text, Breadcrumbs } from '@voltstack/bravais';
import type { BreadcrumbItem } from '@voltstack/bravais';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import useFolderBreadcrumbs from '@/shared/presentation/hooks/use-folder-breadcrumbs';
import { Folder, FolderOpen, Home } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ModalFooterAction } from '@/shared/presentation/components/ModalFooterActions';
import type { FolderBreadcrumbEntity } from '@/shared/presentation/hooks/use-folder-breadcrumbs';

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
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!itemId) {
            setActiveFolderId(null);
            setFolders([]);
            setError(null);
            setSubmitError(null);
            setIsLoading(false);
            setIsSubmitting(false);
            setReloadKey(0);
            return;
        }

        setActiveFolderId(null);
        setError(null);
        setSubmitError(null);
        setFolders([]);
        setIsSubmitting(false);
        setReloadKey(0);
    }, [itemId]);

    const handleInvalidFolder = useCallback(() => {
        setActiveFolderId(null);
        setReloadKey((previousValue) => previousValue + 1);
    }, []);

    const { breadcrumbs, currentFolder } = useFolderBreadcrumbs({
        currentFolderId: activeFolderId,
        getFolder,
        onInvalidFolder: handleInvalidFolder,
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

                setError(reportError(nextError, {
                    surface: ErrorSurface.Silent,
                    fallbackTitle: 'Failed to load folders'
                }).title);
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

    const breadcrumbItems = useMemo<BreadcrumbItem[]>(() => {
        return breadcrumbs.map((crumb) => ({
            id: crumb.id ?? 'root',
            title: crumb.title,
            onClick: () => setActiveFolderId(crumb.id)
        }));
    }, [breadcrumbs]);

    const isCurrentDestination = sourceFolderId === activeFolderId;

    const handleRequestClose = useCallback(() => {
        closeModal(id);
    }, [id]);

    const handleModalClose = useCallback(() => {
        setSubmitError(null);
        onClose();
    }, [onClose]);

    const handleMove = useCallback(async () => {
        setIsSubmitting(true);
        setSubmitError(null);

        try {
            await onSubmit(activeFolderId);
            handleRequestClose();
        } catch (nextError) {
            const userError = reportError(nextError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: `Failed to move ${itemLabel.toLowerCase()}`
            });

            setSubmitError(userError.description ?? userError.title);
        } finally {
            setIsSubmitting(false);
        }
    }, [activeFolderId, handleRequestClose, itemLabel, onSubmit]);

    const handleRetry = useCallback(() => {
        setReloadKey((previousValue) => previousValue + 1);
    }, []);

    const secondaryAction: ModalFooterAction = {
        label: 'Cancel',
        onClick: handleRequestClose,
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
            onClose={handleModalClose}
            footer={<ModalFooterActions primary={primaryAction} secondary={secondaryAction} />}
        >
            <Stack gap='1' p='1-5'>
                <Breadcrumbs items={breadcrumbItems} ariaLabel='Folder breadcrumbs' />

                <Row gap='075'>
                    {activeFolderId ? <FolderOpen size={16} /> : <Home size={16} />}
                    <Text as='p' size='md' tone='secondary'>Current destination: {locationLabel}</Text>
                </Row>

                {isCurrentDestination && (
                    <Text as='p' size='md' tone='muted'>This {itemLabel.toLowerCase()} is already in this location.</Text>
                )}

                {submitError && (
                    <Text as='p' size='md' className='color-danger' role='status' aria-live='polite' aria-atomic='true'>
                        {submitError}
                    </Text>
                )}

                <Stack gap='075'>
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
                        <Text as='p' size='md' tone='muted'>Loading folders...</Text>
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
                        <Text as='p' size='md' tone='muted'>No folders are available here.</Text>
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
                </Stack>
            </Stack>
        </Modal>
    );
}

export default MoveToFolderModal;
