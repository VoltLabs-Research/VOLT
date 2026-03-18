import '@/modules/container/components/organisms/ContainerTerminal/ContainerTerminal.css';
import Container from '@/shared/presentation/components/Container';
import Terminal from '@/shared/presentation/components/Terminal';
import useSocket from '@/modules/socket/core/hooks/use-socket';
import { sileo } from 'sileo';
import { useEffect, useRef } from 'react';
import type { TerminalHandle } from '@/shared/presentation/components/Terminal';
import type { TeamClusterRemoteAccessSession } from '@/modules/cluster/api/entities/team-cluster-remote-access';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

interface ClusterRemoteTerminalSocketError {
    code: string;
    message: string;
    details?: string;
};

interface ClusterRemoteTerminalContentProps {
    teamCluster: TeamCluster;
    session: TeamClusterRemoteAccessSession;
};

const isClusterRemoteTerminalSocketError = (value: unknown): value is ClusterRemoteTerminalSocketError => {
    return typeof value === 'object' && value !== null && 'message' in value && 'code' in value;
};

/**
 * Renders an interactive terminal connected to a cluster host via socket.
 * This is the content-only component without any modal wrapper,
 * intended to be embedded in a full-page layout.
 */
const ClusterRemoteTerminalContent = ({ teamCluster, session }: ClusterRemoteTerminalContentProps) => {
    const socketService = useSocket();
    const terminalRef = useRef<TerminalHandle>(null);
    const isAttachedRef = useRef(false);

    useEffect(() => {
        socketService.connect().catch(() => undefined);

        return () => {
            if (!isAttachedRef.current) {
                return;
            }

            socketService.emitWithoutAck('team-cluster:terminal:detach');
            isAttachedRef.current = false;
        };
    }, [session.sessionId, socketService]);

    useEffect(() => {
        const attach = () => {
            if (isAttachedRef.current || !socketService.isConnected()) {
                return;
            }

            socketService.emitWithoutAck('team-cluster:terminal:attach', {
                sessionId: session.sessionId
            });
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
    }, [session.sessionId, socketService]);

    const handleTerminalData = (data: string) => {
        socketService.emitWithoutAck('team-cluster:terminal:input', data);
    };

    return (
        <Container className='container-terminal-window embedded d-flex column overflow-hidden flex-1'>
            <Container className='container-terminal-header d-flex items-center content-between'>
                <Container className='container-terminal-title d-flex items-center gap-05'>
                    <span>root@{teamCluster.name}:~</span>
                </Container>
            </Container>
            <Container className='container-terminal-body flex-1 overflow-hidden p-relative p-1'>
                <Terminal ref={terminalRef} onData={handleTerminalData} />
            </Container>
        </Container>
    );
};

export default ClusterRemoteTerminalContent;
