import React, { useState, type ReactNode } from 'react';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Container from '@/shared/presentation/components/Container';
import CloseButton from '@/shared/presentation/components/CloseButton';
import FloatingRootContext from '@/shared/presentation/contexts/FloatingRootContext';
import './Modal.css';

declare module 'react' {
    interface ButtonHTMLAttributes<T> extends React.HTMLAttributes<T> {
        command?: string;
        commandfor?: string;
    }
};

interface ModalProps{
    id: string;
    trigger?: ReactNode;
    title?: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    className?: string;
    width?: string;
};

const Modal = ({
    id,
    trigger,
    title,
    description,
    children,
    footer,
    className = '',
    width
}: ModalProps) => {
    // Callback ref stored in state so the context value triggers a re-render
    // once the <dialog> element mounts, giving consumers the actual DOM node.
    const [dialogElement, setDialogElement] = useState<HTMLDialogElement | null>(null);

    const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
        const dialog = e.currentTarget;
        const rect = dialog.getBoundingClientRect();
        const isInDialog = (
            rect.top <= e.clientY && 
            e.clientY <= rect.top + rect.height &&
            rect.left <= e.clientX && 
            e.clientX <= rect.left + rect.width
        );
        if (!isInDialog) {
            dialog.close();
        }
    };

    return (
        <>
            {trigger && React.isValidElement(trigger) ? (
                React.cloneElement(trigger as React.ReactElement<any>, {
                    command: 'show-modal',
                    commandfor: id,
                    type: 'button'
                })
            ) : null}

            <dialog
                ref={setDialogElement}
                id={id}
                className={`volt-modal ${className}`}
                style={width ? { maxWidth: width } : undefined}
                onClick={handleBackdropClick}
            >
                <FloatingRootContext.Provider value={dialogElement ?? undefined}>
                    <Container className='d-flex column w-max'>
                        {(title || description) && (
                            <Container className='d-flex items-start content-between volt-modal-header'>
                                <Container className='d-flex column gap-025'>
                                    {title && <Title className='font-size-4 font-weight-6'>{title}</Title>}
                                    {description && <Paragraph className='font-size-2 color-secondary'>{description}</Paragraph>}
                                </Container>
                                <CloseButton
                                    commandfor={id}
                                    command='close'
                                    aria-label='Close modal'
                                />
                            </Container>
                        )}

                        <Container className='volt-modal-body'>
                            {children}
                        </Container>

                        {footer && (
                            <Container className='d-flex items-center content-end gap-05 volt-modal-footer'>
                                {footer}
                            </Container>
                        )}
                    </Container>
                </FloatingRootContext.Provider>
            </dialog>
        </>
    );
};

export default Modal;

export const openModal = (id: string) => {
    (document.getElementById(id) as HTMLDialogElement)?.showModal();
};

export const closeModal = (id: string) => {
    (document.getElementById(id) as HTMLDialogElement)?.close();
};

export const resetModal = (id: string, reset: () => void, delay = 300) => {
    closeModal(id);
    window.setTimeout(reset, delay);
};
