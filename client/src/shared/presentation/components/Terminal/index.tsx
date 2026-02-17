import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import './Terminal.css';

export interface TerminalHandle {
    write: (data: string) => void;
    clear: () => void;
    focus: () => void;
    fit: () => void;
};

interface TerminalProps {
    onData?: (data: string) => void;
    fontSize?: number;
    fontFamily?: string;
    className?: string;
};

const Terminal = forwardRef<TerminalHandle, TerminalProps>(({
    onData,
    fontSize = 14,
    fontFamily = 'Menlo, Monaco, "Courier New", monospace',
    className = ''
}, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

    useImperativeHandle(ref, () => ({
        write: (data: string) => xtermRef.current?.write(data),
        clear: () => xtermRef.current?.clear(),
        focus: () => xtermRef.current?.focus(),
        fit: () => fitAddonRef.current?.fit()
    }));

    useEffect(() => {
        let term: XTerm | null = null;
        let fitAddon: FitAddon | null = null;
        let fitTimer: number | null = null;
        let isDisposed = false;

        const initTimer = window.setTimeout(() => {
            if(isDisposed || !containerRef.current || xtermRef.current) return;

            const bgColor = getComputedStyle(document.documentElement)
                .getPropertyValue('--color-bg').trim() || '#1e1e1e';

            term = new XTerm({
                cursorBlink: true,
                fontSize,
                fontFamily,
                theme: {
                    background: bgColor,
                    foreground: '#f0f0f0',
                    cursor: '#ffffff',
                    selectionBackground: 'rgba(255, 255, 255, 0.3)'
                },
                allowProposedApi: true
            });

            fitAddon = new FitAddon();
            term.loadAddon(fitAddon);
            term.open(containerRef.current);
            fitAddon.fit();

            xtermRef.current = term;
            fitAddonRef.current = fitAddon;

            if(onData){
                term.onData(onData);
            }

            fitTimer = window.setTimeout(() => {
                if(!isDisposed && fitAddonRef.current){
                    fitAddonRef.current.fit();
                }
            }, 100);
        }, 0);

        const handleResize = () => {
            if(!isDisposed && fitAddonRef.current){
                fitAddonRef.current.fit();
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            isDisposed = true;
            window.clearTimeout(initTimer);
            if(fitTimer !== null){
                window.clearTimeout(fitTimer);
            }
            window.removeEventListener('resize', handleResize);
            term?.dispose();
            xtermRef.current = null;
            fitAddonRef.current = null;
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className={`terminal-container ${className}`}
        />
    );
});

Terminal.displayName = 'Terminal';

export default Terminal;
