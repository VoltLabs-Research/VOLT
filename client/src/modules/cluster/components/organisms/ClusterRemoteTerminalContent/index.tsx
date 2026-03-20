import '@/modules/container/components/organisms/ContainerTerminal/ContainerTerminal.css';
import Container from '@/shared/presentation/components/Container';
import Terminal from '@/shared/presentation/components/Terminal';
import useSocket from '@/modules/socket/core/hooks/use-socket';
import { useMemo, useRef } from 'react';
import { useSocketTerminalSession } from '@/modules/socket/core/hooks/use-socket-terminal-session';
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
    const attachPayload = useMemo(() => ({ sessionId: session.sessionId }), [session.sessionId]);
    const resolveErrorMessage = useMemo(() => {
        return (error: unknown): string => {
            if (typeof error === 'string') {
                return error;
            }

            if (isClusterRemoteTerminalSocketError(error)) {
                return error.details || error.message;
            }

            return 'Terminal error';
        };
    }, []);
    const { handleTerminalData } = useSocketTerminalSession({
        socketService,
        sessionKey: session.sessionId,
        terminalRef,
        attachEvent: 'team-cluster:terminal:attach',
        attachPayload,
        detachEvent: 'team-cluster:terminal:detach',
        dataEvent: 'team-cluster:terminal:data',
        errorEvent: 'team-cluster:terminal:error',
        inputEvent: 'team-cluster:terminal:input',
        resolveErrorMessage
    });

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
