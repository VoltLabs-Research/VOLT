import useContainerRemoteDesktop, { RemoteDesktopConnectionState } from '../../../hooks/use-container-remote-desktop';
import { Monitor, PlugZap } from 'lucide-react';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
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

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await remoteDesktop.connect();
    };

    return (
        <Container className='container-remote-desktop d-flex column gap-1 p-1-5'>
            <Container className='container-remote-desktop-panel d-flex column gap-1'>
                <Container className='d-flex items-start content-between gap-1'>
                    <Container className='d-flex column gap-025'>
                        <Title className='font-size-4 font-weight-6'>Remote Desktop</Title>
                        <p className='font-size-2 color-secondary'>
                            Stream the container XRDP session through Volt. The curated Ubuntu image defaults to username <strong>ubuntu</strong> and password <strong>ubuntu</strong>.
                        </p>
                    </Container>

                    {isConnected && (
                        <Button variant='outline' intent='neutral' leftIcon={<PlugZap size={16} />} onClick={remoteDesktop.disconnect}>
                            Disconnect
                        </Button>
                    )}
                </Container>

                <Container className='d-flex items-center gap-075 flex-wrap'>
                    <span className={`container-remote-desktop-status ${remoteDesktop.connectionState}`} role='status' aria-live='polite' aria-atomic='true'>
                        {CONNECTION_STATUS_LABELS[remoteDesktop.connectionState]}
                    </span>

                    {remoteDesktop.expiresAt && (
                        <span className='font-size-1 color-secondary'>
                            Session token expires at {new Date(remoteDesktop.expiresAt).toLocaleTimeString()}
                        </span>
                    )}
                </Container>

                <form className='container-remote-desktop-form d-flex gap-075 flex-wrap' onSubmit={handleSubmit}>
                    <label className='container-remote-desktop-field d-flex column gap-025'>
                        <span className='font-size-1 color-secondary'>Username</span>
                        <input
                            value={remoteDesktop.credentials.username}
                            onChange={(event) => remoteDesktop.setUsername(event.target.value)}
                            className='container-remote-desktop-input'
                            autoComplete='username'
                        />
                    </label>

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
                            Connect XRDP
                        </Button>
                    </Container>
                </form>

                {remoteDesktop.errorMessage && (
                    <div className='container-remote-desktop-error font-size-2'>
                        {remoteDesktop.errorMessage}
                    </div>
                )}
            </Container>

            <Container className='container-remote-desktop-stage'>
                <div ref={remoteDesktop.displayElementRef} className='container-remote-desktop-display' aria-live='polite' aria-label={`Remote desktop display for ${container.name}`} />
            </Container>
        </Container>
    );
};

export default ContainerRemoteDesktop;
