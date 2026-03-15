import useContainerRemoteDesktop, { RemoteDesktopConnectionState } from '../../../hooks/use-container-remote-desktop';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import { Maximize, Minimize, Monitor, PlugZap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { Container as ContainerEntity } from '@/modules/container/api/entities/container';
import type { FormEvent } from 'react';
import './ContainerRemoteDesktop.css';

interface ContainerRemoteDesktopProps {
    container: ContainerEntity;
};

const CONNECTION_STATUS_LABELS: Record<RemoteDesktopConnectionState, string> = {
    [RemoteDesktopConnectionState.Idle]: 'Ready',
    [RemoteDesktopConnectionState.Connecting]: 'Connecting',
    [RemoteDesktopConnectionState.Connected]: 'Connected',
    [RemoteDesktopConnectionState.Error]: 'Connection failed'
};

const ContainerRemoteDesktop = ({ container }: ContainerRemoteDesktopProps) => {
    const remoteDesktop = useContainerRemoteDesktop(container);
    const isBusy = remoteDesktop.connectionState === RemoteDesktopConnectionState.Connecting;
    const isConnected = remoteDesktop.connectionState === RemoteDesktopConnectionState.Connected;
    const hasActiveSession = remoteDesktop.remoteDesktopUrl !== null;
    const [isFullscreen, setIsFullscreen] = useState(false);

    const syncFullscreenState = useCallback((): void => {
        const nextIsFullscreen = document.fullscreenElement === remoteDesktop.stageElementRef.current;
        setIsFullscreen(nextIsFullscreen);
        remoteDesktop.refreshViewport();

        if (nextIsFullscreen || hasActiveSession) {
            remoteDesktop.focusDisplay();
        }
    }, [hasActiveSession, remoteDesktop]);

    useEffect(() => {
        document.addEventListener('fullscreenchange', syncFullscreenState);

        return () => {
            document.removeEventListener('fullscreenchange', syncFullscreenState);
        };
    }, [syncFullscreenState]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await remoteDesktop.connect();
    };

    const handleToggleFullscreen = useCallback(async (): Promise<void> => {
        const stageElement = remoteDesktop.stageElementRef.current;

        if (!stageElement) {
            return;
        }

        if (document.fullscreenElement === stageElement) {
            await document.exitFullscreen();
            return;
        }

        await stageElement.requestFullscreen();
    }, [remoteDesktop.stageElementRef]);

    const handleDisplayPointerDown = useCallback((): void => {
        remoteDesktop.focusDisplay();
    }, [remoteDesktop]);

    return (
        <Container className='container-remote-desktop d-flex column gap-1 p-1-5'>
            <Container className='container-remote-desktop-panel d-flex column gap-1'>
                <Container className='d-flex items-start content-between gap-1'>
                    <Container className='d-flex column gap-025'>
                        <Title className='font-size-4 font-weight-6'>Remote Desktop</Title>
                        <p className='font-size-2 color-secondary'>
                            Open the container VNC desktop in an embedded noVNC session through Volt. The curated Ubuntu image defaults to password <strong>ubuntu</strong>.
                        </p>
                    </Container>

                    <Container className='d-flex items-center gap-05 flex-wrap'>
                        {hasActiveSession && (
                            <Button
                                variant='outline'
                                intent='neutral'
                                iconOnly
                                aria-label={isFullscreen ? 'Exit fullscreen remote desktop' : 'Enter fullscreen remote desktop'}
                                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                                onClick={handleToggleFullscreen}
                            >
                                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                            </Button>
                        )}

                        {hasActiveSession && (
                            <Button variant='outline' intent='neutral' leftIcon={<PlugZap size={16} />} onClick={remoteDesktop.disconnect}>
                                Disconnect
                            </Button>
                        )}
                    </Container>
                </Container>

                <Container className='d-flex items-center gap-075 flex-wrap'>
                    <span className={`container-remote-desktop-status ${remoteDesktop.connectionState}`} role='status' aria-live='polite' aria-atomic='true'>
                        {CONNECTION_STATUS_LABELS[remoteDesktop.connectionState]}
                    </span>

                    {remoteDesktop.expiresAt && (
                        <span className='font-size-1 color-secondary'>
                            Session expires at {new Date(remoteDesktop.expiresAt).toLocaleTimeString()}
                        </span>
                    )}
                </Container>

                <form className='container-remote-desktop-form d-flex gap-075 flex-wrap' onSubmit={handleSubmit}>
                    <label className='container-remote-desktop-field d-flex column gap-025'>
                        <span className='font-size-1 color-secondary'>Password</span>
                        <input
                            type='password'
                            value={remoteDesktop.credentials.password}
                            onChange={(event) => remoteDesktop.setPassword(event.target.value)}
                            className='container-remote-desktop-input'
                            autoComplete='current-password'
                        />
                    </label>

                    <Container className='d-flex items-end'>
                        <Button type='submit' variant='solid' intent='brand' leftIcon={<Monitor size={16} />} isLoading={isBusy}>
                            Connect VNC
                        </Button>
                    </Container>
                </form>

                {remoteDesktop.errorMessage && (
                    <div className='container-remote-desktop-error font-size-2'>
                        {remoteDesktop.errorMessage}
                    </div>
                )}

                {isConnected && (
                    <p className='container-remote-desktop-hint font-size-1 color-secondary'>
                        Click inside the embedded desktop to focus keyboard input. Use fullscreen for a more reliable remote desktop session.
                    </p>
                )}
            </Container>

            <Container
                ref={remoteDesktop.stageElementRef}
                className={`container-remote-desktop-stage ${isFullscreen ? 'container-remote-desktop-stage--fullscreen' : ''}`}
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
            </Container>
        </Container>
    );
};

export default ContainerRemoteDesktop;
