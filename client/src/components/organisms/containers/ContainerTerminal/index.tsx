import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { IoClose } from 'react-icons/io5';
import { socketService } from '@/services/socketio';
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

// Module-level state to track connections across component instances
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

        // Initialize state for this container if needed
        if (!connectionState[id]) {
            connectionState[id] = { count: 0, isAttached: false, detachTimer: null };
        }
        const state = connectionState[id];

        // Cancel any pending detach
        if (state.detachTimer) {
            clearTimeout(state.detachTimer);
            state.detachTimer = null;
        }

        state.count++;

        // Initialize socket
        socketService.connect();

        // Initialize xterm.js
        if (terminalRef.current && !xtermRef.current) {
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

            // Handle user input
            term.onData((data) => {
                socketService.emit('container:terminal:input', data);
            });

            // Handle resize
            const handleResize = () => {
                fitAddon.fit();
                // Optional: Send resize to backend if supported
                // const dims = fitAddon.proposeDimensions();
                // if (dims) socketService.emit('container:terminal:resize', dims);
            };

            window.addEventListener('resize', handleResize);

            // Initial fit after a small delay to ensure container is rendered
            setTimeout(() => fitAddon.fit(), 100);

            // Cleanup for this instance
            return () => {
                window.removeEventListener('resize', handleResize);
                term.dispose();
                xtermRef.current = null;
            };
        }
    }, []); // Run once on mount to setup terminal

    useEffect(() => {
        const id = container._id;
        const state = connectionState[id];

        // Attach to container if not already attached
        if (!state.isAttached) {
            socketService.emit('container:terminal:attach', { containerId: id });
            state.isAttached = true;
        }

        // Handle incoming data
        const handleData = (data: string) => {
            xtermRef.current?.write(data);
        };

        const handleError = (error: string) => {
            xtermRef.current?.write(`\r\n\x1b[31mError: ${error}\x1b[0m\r\n`);
        };

        socketService.on('container:terminal:data', handleData);
        socketService.on('container:error', handleError);

        return () => {
            socketService.off('container:terminal:data', handleData);
            socketService.off('container:error', handleError);

            state.count--;

            if (state.count === 0) {
                state.detachTimer = setTimeout(() => {
                    if (state.count === 0) {
                        socketService.emit('container:terminal:detach');
                        state.isAttached = false;
                        delete connectionState[id];
                    }
                }, 100);
            }
        };
    }, [container._id]);

    const content = (
        <div className={`terminal-window ${embedded ? 'embedded' : ''}`}>
            <div className='terminal-header'>
                <div className='terminal-title'>
                    <span>root@{container.name}:~</span>
                </div>
                {!embedded && (
                    <button onClick={onClose} className='close-btn'>
                        <IoClose size={20} />
                    </button>
                )}
            </div>
            <div className='terminal-body xterm-container' ref={terminalRef} />
        </div>
    );

    if (embedded) return content;

    return (
        <div className='terminal-overlay'>
            {content}
        </div>
    );
};

export default ContainerTerminal;
