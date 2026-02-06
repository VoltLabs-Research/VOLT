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
        if(!containerRef.current || xtermRef.current) return;

        const bgColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--color-bg').trim() || '#1e1e1e';

        const term = new XTerm({
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

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(containerRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        if(onData){
            term.onData(onData);
        }

        const handleResize = () => fitAddon.fit();
        window.addEventListener('resize', handleResize);

        setTimeout(() => fitAddon.fit(), 100);

        return () => {
            window.removeEventListener('resize', handleResize);
            term.dispose();
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
