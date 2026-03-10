import '@/modules/container/components/organisms/ContainerTerminal/ContainerTerminal.css';
import { closeModal } from '@/shared/presentation/components/Modal';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Modal from '@/shared/presentation/components/Modal';
import Terminal from '@/shared/presentation/components/Terminal';
import useSocket from '@/modules/socket/core/hooks/use-socket';
import { sileo } from 'sileo';
import { useEffect, useRef } from 'react';
import type { TerminalHandle } from '@/shared/presentation/components/Terminal';
import type { TeamClusterRemoteAccessSession } from '@/modules/cluster/api/entities/team-cluster-remote-access';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

export const CLUSTER_REMOTE_TERMINAL_MODAL_ID = 'cluster-remote-terminal-modal';

interface ClusterRemoteTerminalSocketError {
    code: string;
    message: string;
    details?: string;
};

interface ClusterRemoteTerminalProps {
    teamCluster: TeamCluster | null;
    session: TeamClusterRemoteAccessSession | null;
    onClose: () => void;
};

const isClusterRemoteTerminalSocketError = (value: unknown): value is ClusterRemoteTerminalSocketError => {
    return typeof value === 'object' && value !== null && 'message' in value && 'code' in value;
};

const ClusterRemoteTerminal = ({ teamCluster, session, onClose }: ClusterRemoteTerminalProps) => {
    const socketService = useSocket();
    const terminalRef = useRef<TerminalHandle>(null);
    const isAttachedRef = useRef(false);

    useEffect(() => {
        if (!session) {
            return;
        }

        socketService.connect().catch(() => undefined);

        return () => {
            if (!isAttachedRef.current) {
                return;
            }

            socketService.emit('team-cluster:terminal:detach').catch(() => undefined);
            isAttachedRef.current = false;
        };
    }, [session?.sessionId, socketService]);

    useEffect(() => {
        if (!session) {
            return;
        }

        const attach = () => {
            if (isAttachedRef.current || !socketService.isConnected()) {
                return;
            }

            socketService.emit('team-cluster:terminal:attach', {
                sessionId: session.sessionId
            }).catch(() => undefined);
            isAttachedRef.current = true;
        };

        const handleData = (...args: unknown[]) => {
            const [data] = args;
            if (typeof data !== 'string') {
                return;
            }

            terminalRef.current?.write(data);
        };

        const handleError = (...args: unknown[]) => {
            const [error] = args;
            let description = 'Terminal error';

            if (typeof error === 'string') {
                description = error;
            } else if (isClusterRemoteTerminalSocketError(error)) {
                description = error.details || error.message;
            }

            terminalRef.current?.write(`\r\n\x1b[31mError: ${description}\x1b[0m\r\n`);
            sileo.error({
                title: 'Terminal error',
                description
            });
        };

        const unsubscribeData = socketService.on('team-cluster:terminal:data', handleData);
        const unsubscribeError = socketService.on('team-cluster:terminal:error', handleError);
        const unsubscribeConnection = socketService.onConnectionChange((connected) => {
            if (connected) {
                attach();
            }
        });

        if (socketService.isConnected()) {
            attach();
        }

        return () => {
            unsubscribeData();
            unsubscribeError();
            unsubscribeConnection();
        };
    }, [session?.sessionId, socketService]);

    const handleTerminalData = (data: string) => {
        socketService.emit('team-cluster:terminal:input', data).catch(() => undefined);
    };

    const handleClose = () => {
        closeModal(CLUSTER_REMOTE_TERMINAL_MODAL_ID);
        onClose();
    };

    return (
        <Modal
            id={CLUSTER_REMOTE_TERMINAL_MODAL_ID}
            title={teamCluster ? `${teamCluster.name} Terminal` : 'Cluster Terminal'}
            description='Interactive shell running on the selected cluster host.'
            width='min(96vw, 1400px)'
            onClose={onClose}
        >
            <Container className='container-terminal-window embedded d-flex column overflow-hidden'>
                <Container className='container-terminal-header d-flex items-center content-between'>
                    <Container className='container-terminal-title d-flex items-center gap-05'>
                        <span>root@{teamCluster?.name ?? 'cluster'}:~</span>
                    </Container>
                    <Button variant='ghost' intent='neutral' size='sm' onClick={handleClose}>
                        Close
                    </Button>
                </Container>
                <Container className='container-terminal-body flex-1 overflow-hidden p-relative p-1'>
                    <Terminal ref={terminalRef} onData={handleTerminalData} />
                </Container>
            </Container>
        </Modal>
    );
};

export default ClusterRemoteTerminal;
