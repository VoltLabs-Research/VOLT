import CloseButton from '../CloseButton';
import FloatingRootContext, { TopLayerRootContext } from '@/shared/presentation/contexts/FloatingRootContext';
import useMedia from '@/shared/presentation/hooks/use-media';
import './Modal.css';
import React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

declare module 'react' {
    interface ButtonHTMLAttributes<T> extends React.HTMLAttributes<T> {
        command?: string;
        commandfor?: string;
    }
}

type ModalTriggerElement = React.ReactElement<React.ButtonHTMLAttributes<HTMLButtonElement>>;

interface ModalProps {
    id: string;
    trigger?: ReactNode;
    title?: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    className?: string;
    width?: string;
    onClose?: () => void;
    dismissible?: boolean;
    lazyMount?: boolean;
};

const COARSE_POINTER_MEDIA_QUERY = '(pointer: coarse)';
const LAZY_MOUNT_UNMOUNT_DELAY_MS = 250;

const isDialogElement = (element: HTMLElement | null): element is HTMLDialogElement => {
    return element instanceof HTMLDialogElement;
};

const getFocusableElements = (dialog: HTMLDialogElement) => {
    const selector = [
        'button:not([disabled])',
        '[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    const focusableElements = dialog.querySelectorAll<HTMLElement>(selector);

    return Array.from(focusableElements).filter((element) => {
        return !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true';
    });
};

const getInitialFocusTarget = (dialog: HTMLDialogElement, isCoarsePointer: boolean) => {
    if (isCoarsePointer) {
        return dialog;
    }

    const preferredFocusTarget = dialog.querySelector<HTMLElement>('[data-modal-initial-focus="true"]');
    if (preferredFocusTarget && !preferredFocusTarget.hasAttribute('disabled')) {
        return preferredFocusTarget;
    }

    const autofocusElement = dialog.querySelector<HTMLElement>('[autofocus]');
    if (autofocusElement && !autofocusElement.hasAttribute('disabled')) {
        return autofocusElement;
    }

    return getFocusableElements(dialog)[0] ?? dialog;
};

const Modal = ({
    id,
    trigger,
    title,
    description,
    children,
    footer,
    className = '',
    width,
    onClose,
    dismissible = true,
    lazyMount = false
}: ModalProps) => {
    const [dialogElement, setDialogElement] = useState<HTMLDialogElement | null>(null);
    const [shouldRenderContents, setShouldRenderContents] = useState(!lazyMount);
    const restoreFocusElementRef = useRef<HTMLElement | null>(null);
    const isCoarsePointer = useMedia(COARSE_POINTER_MEDIA_QUERY);
    const titleId = title ? `${id}-title` : undefined;
    const descriptionId = description ? `${id}-description` : undefined;

    useEffect(() => {
        if (!dialogElement) {
            return;
        }

        let unmountTimeoutId: ReturnType<typeof setTimeout> | null = null;

        const clearUnmountTimer = () => {
            if (unmountTimeoutId !== null) {
                clearTimeout(unmountTimeoutId);
                unmountTimeoutId = null;
            }
        };

        const syncDialogState = () => {
            if (dialogElement.open) {
                if (lazyMount) {
                    clearUnmountTimer();
                    setShouldRenderContents(true);
                }

                if (!restoreFocusElementRef.current && document.activeElement instanceof HTMLElement) {
                    restoreFocusElementRef.current = document.activeElement;
                }

                window.requestAnimationFrame(() => {
                    if (!dialogElement.open) {
                        return;
                    }

                    const focusTarget = getInitialFocusTarget(dialogElement, isCoarsePointer);
                    focusTarget.focus({ preventScroll: true });
                });

                return;
            }

            if (lazyMount) {
                clearUnmountTimer();
                unmountTimeoutId = setTimeout(() => {
                    setShouldRenderContents(false);
                    unmountTimeoutId = null;
                }, LAZY_MOUNT_UNMOUNT_DELAY_MS);
            }

            if (restoreFocusElementRef.current?.isConnected) {
                restoreFocusElementRef.current.focus({ preventScroll: true });
            }

            restoreFocusElementRef.current = null;
        };

        const observer = new MutationObserver(syncDialogState);
        observer.observe(dialogElement, { attributes: true, attributeFilter: ['open'] });
        syncDialogState();

        return () => {
            observer.disconnect();
            clearUnmountTimer();
            restoreFocusElementRef.current = null;
        };
    }, [dialogElement, isCoarsePointer, lazyMount]);

    const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
        if (!dismissible) {
            return;
        }

        const dialog = event.currentTarget;
        const rect = dialog.getBoundingClientRect();
        const isInDialog = (
            rect.top <= event.clientY
            && event.clientY <= rect.top + rect.height
            && rect.left <= event.clientX
            && event.clientX <= rect.left + rect.width
        );

        if (!isInDialog) {
            dialog.close();
        }
    };

    const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
        if (!dismissible) {
            event.preventDefault();
        }
    };

    return (
        <>
            {trigger && React.isValidElement(trigger) ? (
                React.cloneElement(trigger as ModalTriggerElement, {
                    command: 'show-modal',
                    commandfor: id,
                    'aria-controls': id,
                    'aria-haspopup': 'dialog',
                    type: 'button'
                })
            ) : null}

            <dialog
                ref={setDialogElement}
                id={id}
                className={`volt-modal ${className}`}
                style={width ? { maxWidth: width } : undefined}
                onClick={handleBackdropClick}
                onCancel={handleCancel}
                onClose={onClose}
                aria-modal='true'
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                tabIndex={-1}
            >
                <TopLayerRootContext.Provider value={dialogElement ?? undefined}>
                    <FloatingRootContext.Provider value={dialogElement ?? undefined}>
                        {shouldRenderContents && (
                            <div className='d-flex column w-max'>
                                {(title || description) && (
                                    <div className='d-flex items-start content-between volt-modal-header'>
                                        <div className='d-flex column gap-025'>
                                            {title && <h3 id={titleId} className='font-size-4 font-weight-6'>{title}</h3>}
                                            {description && <p id={descriptionId} className='font-size-2 color-secondary'>{description}</p>}
                                        </div>
                                        {dismissible && (
                                            <CloseButton
                                                commandfor={id}
                                                command='close'
                                                aria-label='Close modal'
                                            />
                                        )}
                                    </div>
                                )}

                                <div className='volt-modal-body'>
                                    {children}
                                </div>

                                {footer && (
                                    <div className='d-flex items-center content-end gap-05 volt-modal-footer'>
                                        {footer}
                                    </div>
                                )}
                            </div>
                        )}
                    </FloatingRootContext.Provider>
                </TopLayerRootContext.Provider>
            </dialog>
        </>
    );
};

export default Modal;

/** Opens a modal dialog by id when it is not already open. */
export const openModal = (id: string) => {
    const element = document.getElementById(id);
    if (isDialogElement(element) && !element.open) {
        element.showModal();
        const toaster = document.getElementById('app-toaster-popover');
        if (toaster) {
            toaster.hidePopover();
            toaster.showPopover();
        }
    }
};

/** Closes a modal dialog by id when it is open. */
export const closeModal = (id: string) => {
    const element = document.getElementById(id);
    if (isDialogElement(element) && element.open) {
        element.close();
    }
};

/** Closes a modal and runs reset work after the close animation delay. */
export const resetModal = (id: string, reset: () => void, delay = 300) => {
    closeModal(id);
    window.setTimeout(reset, delay);
};
