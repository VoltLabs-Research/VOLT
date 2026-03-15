import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import { Monitor } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import type { Container as ContainerEntity } from '@/modules/container/api/entities/container';
import { RemoteDesktopConnectionState } from '../../../hooks/use-container-remote-desktop';
import { closeModal, openModal } from '@/shared/presentation/components/Modal';
import useContainerRemoteDesktop from '../../../hooks/use-container-remote-desktop';
import Modal from '@/shared/presentation/components/Modal';
import './ContainerRemoteDesktop.css';

interface ContainerRemoteDesktopProps {
    container: ContainerEntity;
};

const REMOTE_DESKTOP_PASSWORD_MODAL_ID = 'container-remote-desktop-password-modal';

const CONNECTION_STATUS_LABELS: Record<RemoteDesktopConnectionState, string> = {
    [RemoteDesktopConnectionState.Idle]: 'Awaiting password',
    [RemoteDesktopConnectionState.Connecting]: 'Connecting',
    [RemoteDesktopConnectionState.Connected]: 'Connected',
    [RemoteDesktopConnectionState.Error]: 'Connection failed'
};

const ContainerRemoteDesktop = ({ container }: ContainerRemoteDesktopProps) => {
    const remoteDesktop = useContainerRemoteDesktop(container);
    const isBusy = remoteDesktop.connectionState === RemoteDesktopConnectionState.Connecting;
    const isConnected = remoteDesktop.connectionState === RemoteDesktopConnectionState.Connected;

    const modalDescription = useMemo(() => {
        if (remoteDesktop.connectionState === RemoteDesktopConnectionState.Error && remoteDesktop.errorMessage) {
            return remoteDesktop.errorMessage;
        }

        return 'Enter the same shared password you set for the container Linux user and VNC access. noVNC still connects with the password only.';
    }, [remoteDesktop.connectionState, remoteDesktop.errorMessage]);

    useEffect(() => {
        if (isConnected) {
            closeModal(REMOTE_DESKTOP_PASSWORD_MODAL_ID);
            remoteDesktop.refreshViewport();
            return;
        }

        openModal(REMOTE_DESKTOP_PASSWORD_MODAL_ID);
    }, [isConnected]);

    const handleConnect = useCallback(async (): Promise<void> => {
        await remoteDesktop.connect();
    }, [remoteDesktop]);

    const handleDisplayPointerDown = useCallback((): void => {
        remoteDesktop.focusDisplay();
    }, [remoteDesktop]);

    const modalFooter = (
        <ModalFooterActions
            primary={{
                label: 'Connect VNC',
                onClick: handleConnect,
                leftIcon: <Monitor size={16} />,
                isLoading: isBusy
            }}
        />
    );

    return (
        <>
            <Modal
                id={REMOTE_DESKTOP_PASSWORD_MODAL_ID}
                footer={modalFooter}
                className='container-remote-desktop-modal'
                onClose={() => {
                    if (!isConnected) {
                        window.setTimeout(() => {
                            openModal(REMOTE_DESKTOP_PASSWORD_MODAL_ID);
                        }, 0);
                    }
                }}
            >
                <Container className='d-flex column gap-1 p-1-5'>
                    <Container className='d-flex column gap-025'>
                        <h2 className='font-size-4 font-weight-6'>Remote Desktop Password</h2>
                        <p className='font-size-2 color-secondary'>{modalDescription}</p>
                    </Container>

                    <FormFieldRHF
                        label='Shared VNC password'
                        name='container-remote-desktop-password'
                        type='password'
                        autoFocus
                        value={remoteDesktop.credentials.password}
                        error={remoteDesktop.connectionState === RemoteDesktopConnectionState.Error ? remoteDesktop.errorMessage ?? undefined : undefined}
                        onChange={(event) => remoteDesktop.setPassword(event.target.value)}
                        inputProps={{
                            autoComplete: 'current-password',
                            onKeyDown: (event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    handleConnect();
                                }
                            }
                        }}
                    />
                </Container>
            </Modal>

            <Container className='container-remote-desktop-shell d-flex column flex-1 h-max'>
                <Container
                    ref={remoteDesktop.stageElementRef}
                    className='container-remote-desktop-stage'
                >
                    {remoteDesktop.remoteDesktopUrl && (
                        <iframe
                            ref={remoteDesktop.frameElementRef}
                            src={remoteDesktop.remoteDesktopUrl}
                            title={`Remote desktop display for ${container.name}`}
                            className='container-remote-desktop-display'
                            allow='clipboard-read; clipboard-write; fullscreen'
                            onError={remoteDesktop.handleFrameError}
                            onMouseDown={handleDisplayPointerDown}
                        />
                    )}

                    {!remoteDesktop.remoteDesktopUrl && (
                        <Container className='container-remote-desktop-placeholder d-flex column flex-center gap-075'>
                            <Monitor size={28} />
                            <span className={`container-remote-desktop-status ${remoteDesktop.connectionState}`} role='status' aria-live='polite' aria-atomic='true'>
                                {CONNECTION_STATUS_LABELS[remoteDesktop.connectionState]}
                            </span>
                            {remoteDesktop.expiresAt && (
                                <span className='font-size-1 color-secondary'>
                                    Session expires at {new Date(remoteDesktop.expiresAt).toLocaleTimeString()}
                                </span>
                            )}
                        </Container>
                    )}
                </Container>
            </Container>
        </>
    );
};

export default ContainerRemoteDesktop;
