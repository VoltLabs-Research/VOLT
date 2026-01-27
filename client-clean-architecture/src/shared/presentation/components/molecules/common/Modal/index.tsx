import React, { type ReactNode } from 'react';
import Title from '@/shared/presentation/components/primitives/Title';
import Paragraph from '@/shared/presentation/components/primitives/Paragraph';
import Container from '@/shared/presentation/components/primitives/Container';
import Button from '@/shared/presentation/components/primitives/Button';
import Tooltip from '@/shared/presentation/components/atoms/common/Tooltip';
import { IoClose } from 'react-icons/io5';
import '@/shared/presentation/components/molecules/common/Modal/Modal.css';

declare module 'react' {
    interface ButtonHTMLAttributes<T> extends React.HTMLAttributes<T> {
        command?: string;
        commandfor?: string;
    }
}

interface ModalProps {
    id: string;
    trigger?: ReactNode;
    title?: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    className?: string;
    width?: string;
}

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
                id={id}
                className={`volt-modal ${className}`}
                style={width ? { maxWidth: width } : undefined}
                onClick={(e) => {
                    const dialog = e.currentTarget;
                    const rect = dialog.getBoundingClientRect();
                    const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
                        rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
                    if (!isInDialog) {
                        dialog.close();
                    }
                }}
            >
                <Container className='d-flex column w-max'>
                    {(title || description) && (
                        <Container className='d-flex items-start content-between volt-modal-header'>
                            <Container className='d-flex column gap-025'>
                                {title && <Title className='font-size-4 font-weight-6'>{title}</Title>}
                                {description && <Paragraph className='font-size-2 color-secondary'>{description}</Paragraph>}
                            </Container>
                            <Tooltip content="Close" placement="left">
                                <Button
                                    variant='ghost'
                                    intent='neutral'
                                    iconOnly
                                    size='sm'
                                    commandfor={id}
                                    command='close'
                                    aria-label="Close modal"
                                >
                                    <IoClose size={20} />
                                </Button>
                            </Tooltip>
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
            </dialog>
        </>
    );
};

export default Modal;
