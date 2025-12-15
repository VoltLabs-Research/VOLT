import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { IoClose } from 'react-icons/io5';
import { socketService } from '@/services/socketio';
import Container from '@/components/primitives/Container';
import 'xterm/css/xterm.css';
import './ContainerTerminal.css';

interface ContainerTerminalProps {
    container: {
        _id: string;
        name: string;
        containerId: string;
    };
    onClose: () => void;
    embedded?: boolean;
}

const connectionState: Record<string, {
    count: number;
    isAttached: boolean;
    detachTimer: ReturnType<typeof setTimeout> | null;
}> = {};

const ContainerTerminal: React.FC<ContainerTerminalProps> = ({ container, onClose, embedded = false }) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

    useEffect(() => {
        const id = container._id;
        if(!connectionState[id]){
            connectionState[id] = { count: 0, isAttached: false, detachTimer: null };
        }
        const state = connectionState[id];

        if(state.detachTimer){
            clearTimeout(state.detachTimer);
            state.detachTimer = null;
        }

        state.count++;

        socketService.connect();

        if(terminalRef.current && !xtermRef.current){
            const term = new Terminal({
                cursorBlink: true,
                fontSize: 14,
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                theme: {
                    background: '#1e1e1e',
                    foreground: '#f0f0f0',
                    cursor: '#ffffff',
                    selectionBackground: 'rgba(255, 255, 255, 0.3)'
                },
                allowProposedApi: true
            });

            const fitAddon = new FitAddon();
            term.loadAddon(fitAddon);

            term.open(terminalRef.current);
            fitAddon.fit();

            xtermRef.current = term;
            fitAddonRef.current = fitAddon;

            term.onData((data) => {
                socketService.emit('container:terminal:input', data);
            });

            const handleResize = () => {
                fitAddon.fit();
            };

            window.addEventListener('resize', handleResize);

            setTimeout(() => fitAddon.fit(), 100);

            return() => {
                window.removeEventListener('resize', handleResize);
                term.dispose();
                xtermRef.current = null;
            };
        }
    }, []);

    useEffect(() => {
        const id = container._id;
        const state = connectionState[id];

        if(!state.isAttached){
            socketService.emit('container:terminal:attach', { containerId: id });
            state.isAttached = true;
        }

        const handleData = (data: string) => {
            xtermRef.current?.write(data);
        };

        const handleError = (error: string) => {
            xtermRef.current?.write(`\r\n\x1b[31mError: ${error}\x1b[0m\r\n`);
        };

        socketService.on('container:terminal:data', handleData);
        socketService.on('container:error', handleError);

        return() => {
            socketService.off('container:terminal:data', handleData);
            socketService.off('container:error', handleError);

            state.count--;

            if(state.count === 0){
                state.detachTimer = setTimeout(() => {
                    if(state.count === 0){
                        socketService.emit('container:terminal:detach');
                        state.isAttached = false;
                        delete connectionState[id];
                    }
                }, 100);
            }
        };
    }, [container._id]);

    const content = (
        <Container className={`d-flex column overflow-hidden terminal-window ${embedded ? 'embedded' : ''}`}>
            <Container className='d-flex content-between items-center terminal-header'>
                <Container className='d-flex items-center gap-05 terminal-title'>
                    <span>root@{container.name}:~</span>
                </Container>
                {!embedded && (
                    <button onClick={onClose} className='close-btn'>
                        <IoClose size={20} />
                    </button>
                )}
            </Container>
            <Container className='flex-1 overflow-hidden p-relative terminal-body' ref={terminalRef} />
        </Container>
    );

    if(embedded) return content;

    return(
        <Container className='p-fixed inset-0 d-flex items-center content-center terminal-overlay'>
            {content}
        </Container>
    );
};

export default ContainerTerminal;
