import './Terminal.css';
import 'xterm/css/xterm.css';
import { subscribeToAppTheme } from '@/shared/presentation/utilities/ensure-monaco';
import { FitAddon } from 'xterm-addon-fit';
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal as XTerm } from 'xterm';

interface TerminalTheme {
    background: string;
    cursor: string;
    foreground: string;
    selectionBackground: string;
};

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

const getTerminalTheme = (): TerminalTheme => {
    const styles = getComputedStyle(document.documentElement);
    const background = styles.getPropertyValue('--color-surface-1').trim()
        || styles.getPropertyValue('--color-bg').trim()
        || '#171719';
    const foreground = styles.getPropertyValue('--color-text-primary').trim() || '#f0f0f0';
    const cursor = styles.getPropertyValue('--focus-ring').trim() || foreground;
    const selectionBackground = styles.getPropertyValue('--hover-bg').trim() || 'rgba(255, 255, 255, 0.12)';

    return {
        background,
        cursor,
        foreground,
        selectionBackground
    };
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
        let disposeThemeSubscription: (() => void) | null = null;

        const initTimer = window.setTimeout(() => {
            if (isDisposed || !containerRef.current || xtermRef.current) return;

            const theme = getTerminalTheme();

            term = new XTerm({
                cursorBlink: true,
                fontSize,
                fontFamily,
                theme,
                allowProposedApi: true
            });

            fitAddon = new FitAddon();
            term.loadAddon(fitAddon);
            term.open(containerRef.current);
            fitAddon.fit();

            xtermRef.current = term;
            fitAddonRef.current = fitAddon;

            disposeThemeSubscription = subscribeToAppTheme(() => {
                const activeTerminal = xtermRef.current;

                if (!activeTerminal) {
                    return;
                }

                activeTerminal.options.theme = getTerminalTheme();
                fitAddonRef.current?.fit();
            });

            if (onData) {
                term.onData(onData);
            }

            fitTimer = window.setTimeout(() => {
                if (!isDisposed && fitAddonRef.current) {
                    fitAddonRef.current.fit();
                }
            }, 100);
        }, 0);

        const handleResize = () => {
            if (!isDisposed && fitAddonRef.current) {
                fitAddonRef.current.fit();
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            isDisposed = true;
            window.clearTimeout(initTimer);

            if (fitTimer !== null) {
                window.clearTimeout(fitTimer);
            }

            disposeThemeSubscription?.();
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
