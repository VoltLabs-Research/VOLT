import './Terminal.css';
import 'xterm/css/xterm.css';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import { subscribeToAppTheme } from '@/shared/presentation/utilities/app-theme';
import { FitAddon } from 'xterm-addon-fit';
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import type { IDisposable } from 'xterm';

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
    ariaLabel?: string;
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
    className = '',
    ariaLabel = 'Terminal'
}, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const onDataRef = useRef(onData);
    const onDataDisposableRef = useRef<IDisposable | null>(null);
    const prefersReducedMotion = usePrefersReducedMotion();

    useEffect(() => {
        onDataRef.current = onData;
    }, [onData]);

    useEffect(() => {
        onDataDisposableRef.current?.dispose();

        if (!xtermRef.current || !onData) {
            onDataDisposableRef.current = null;
            return;
        }

        onDataDisposableRef.current = xtermRef.current.onData(onData);

        return () => {
            onDataDisposableRef.current?.dispose();
            onDataDisposableRef.current = null;
        };
    }, [onData]);

    useImperativeHandle(ref, () => ({
        write: (data: string) => xtermRef.current?.write(data),
        clear: () => xtermRef.current?.clear(),
        focus: () => xtermRef.current?.focus(),
        fit: () => fitAddonRef.current?.fit()
    }));

    useEffect(() => {
        let term: XTerm | null = null;
        let fitAddon: FitAddon | null = null;
        let resizeObserver: ResizeObserver | null = null;
        let animationFrameId: number | null = null;
        let isDisposed = false;
        let disposeThemeSubscription: (() => void) | null = null;

        const fitTerminal = () => {
            if (!isDisposed && fitAddonRef.current) {
                fitAddonRef.current.fit();
            }
        };

        const scheduleFit = () => {
            if (animationFrameId !== null) {
                window.cancelAnimationFrame(animationFrameId);
            }

            animationFrameId = window.requestAnimationFrame(() => {
                animationFrameId = null;
                fitTerminal();
            });
        };

        animationFrameId = window.requestAnimationFrame(() => {
            if (isDisposed || !containerRef.current || xtermRef.current) return;

            const theme = getTerminalTheme();

            term = new XTerm({
                cursorBlink: !prefersReducedMotion,
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
            onDataDisposableRef.current = onDataRef.current ? term.onData(onDataRef.current) : null;

            disposeThemeSubscription = subscribeToAppTheme(() => {
                const activeTerminal = xtermRef.current;

                if (!activeTerminal) {
                    return;
                }

                activeTerminal.options.theme = getTerminalTheme();
                scheduleFit();
            });

            resizeObserver = new ResizeObserver(() => {
                scheduleFit();
            });
            resizeObserver.observe(containerRef.current);

            if (document.visibilityState === 'visible') {
                scheduleFit();
            }
        });

        return () => {
            isDisposed = true;
            onDataDisposableRef.current?.dispose();
            onDataDisposableRef.current = null;

            if (animationFrameId !== null) {
                window.cancelAnimationFrame(animationFrameId);
            }

            resizeObserver?.disconnect();
            disposeThemeSubscription?.();
            term?.dispose();
            xtermRef.current = null;
            fitAddonRef.current = null;
        };
    }, [fontFamily, fontSize]);

    useEffect(() => {
        if (!xtermRef.current) {
            return;
        }

        xtermRef.current.options.cursorBlink = !prefersReducedMotion;
    }, [prefersReducedMotion]);

    return (
        <div
            ref={containerRef}
            className={`terminal-container ${className}`}
            role='region'
            aria-label={ariaLabel}
        />
    );
});

Terminal.displayName = 'Terminal';

export default Terminal;
