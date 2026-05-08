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
    value?: string;
};

type PendingTerminalOperation =
    | { type: 'write'; data: string }
    | { type: 'clear' };

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
    fontFamily = '"JetBrains Mono Variable", "JetBrains Mono", "Cascadia Code", "Cascadia Mono", Consolas, monospace',
    className = '',
    ariaLabel = 'Terminal',
    value
}, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const onDataRef = useRef(onData);
    const onDataDisposableRef = useRef<IDisposable | null>(null);
    const isReadyRef = useRef(false);
    const lastRenderedValueRef = useRef('');
    const pendingControlledValueRef = useRef<string | undefined>(value);
    const pendingOperationsRef = useRef<PendingTerminalOperation[]>([]);
    const prefersReducedMotion = usePrefersReducedMotion();

    const syncControlledValue = (nextValue: string) => {
        const terminal = xtermRef.current;
        if (!terminal || !isReadyRef.current) {
            pendingControlledValueRef.current = nextValue;
            return;
        }

        const previousValue = lastRenderedValueRef.current;
        if (nextValue === previousValue) {
            pendingControlledValueRef.current = nextValue;
            return;
        }

        if (nextValue.startsWith(previousValue)) {
            const delta = nextValue.slice(previousValue.length);
            if (delta.length > 0) {
                terminal.write(delta);
            }
        } else {
            terminal.clear();
            if (nextValue.length > 0) {
                terminal.write(nextValue);
            }
        }

        lastRenderedValueRef.current = nextValue;
        pendingControlledValueRef.current = nextValue;
    };

    const flushPendingOutput = () => {
        const terminal = xtermRef.current;
        if (!terminal || !isReadyRef.current) {
            return;
        }

        if (typeof pendingControlledValueRef.current === 'string') {
            pendingOperationsRef.current = [];
            syncControlledValue(pendingControlledValueRef.current);
            return;
        }

        const operations = pendingOperationsRef.current;
        pendingOperationsRef.current = [];

        for (const operation of operations) {
            if (operation.type === 'clear') {
                terminal.clear();
                lastRenderedValueRef.current = '';
                continue;
            }

            if (operation.data.length === 0) {
                continue;
            }

            terminal.write(operation.data);
            lastRenderedValueRef.current = `${lastRenderedValueRef.current}${operation.data}`;
        }
    };

    useEffect(() => {
        onDataRef.current = onData;
    }, [onData]);

    useEffect(() => {
        pendingControlledValueRef.current = value;

        if (typeof value !== 'string') {
            return;
        }

        syncControlledValue(value);
    }, [value]);

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
        write: (data: string) => {
            if (data.length === 0) {
                return;
            }

            if (!xtermRef.current || !isReadyRef.current) {
                pendingOperationsRef.current.push({ type: 'write', data });
                return;
            }

            xtermRef.current.write(data);
            lastRenderedValueRef.current = `${lastRenderedValueRef.current}${data}`;
        },
        clear: () => {
            if (!xtermRef.current || !isReadyRef.current) {
                pendingOperationsRef.current.push({ type: 'clear' });
                lastRenderedValueRef.current = '';
                return;
            }

            xtermRef.current.clear();
            lastRenderedValueRef.current = '';
        },
        focus: () => xtermRef.current?.focus(),
        fit: () => {
            if (!fitAddonRef.current || !isReadyRef.current) {
                return;
            }

            fitAddonRef.current.fit();
        }
    }));

    useEffect(() => {
        let term: XTerm | null = null;
        let fitAddon: FitAddon | null = null;
        let resizeObserver: ResizeObserver | null = null;
        let openFrameId: number | null = null;
        let fitFrameId: number | null = null;
        let isDisposed = false;
        let disposeThemeSubscription: (() => void) | null = null;

        const fitTerminal = () => {
            if (!isDisposed && fitAddonRef.current) {
                try {
                    fitAddonRef.current.fit();
                    isReadyRef.current = true;
                    flushPendingOutput();
                } catch {
                    return;
                }
            }
        };

        const scheduleFit = () => {
            if (fitFrameId !== null) {
                window.cancelAnimationFrame(fitFrameId);
            }

            fitFrameId = window.requestAnimationFrame(() => {
                fitFrameId = null;
                fitTerminal();
            });
        };

        openFrameId = window.requestAnimationFrame(() => {
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

            scheduleFit();
        });

        return () => {
            isDisposed = true;
            isReadyRef.current = false;
            onDataDisposableRef.current?.dispose();
            onDataDisposableRef.current = null;
            pendingOperationsRef.current = [];
            lastRenderedValueRef.current = '';

            if (openFrameId !== null) {
                window.cancelAnimationFrame(openFrameId);
            }

            if (fitFrameId !== null) {
                window.cancelAnimationFrame(fitFrameId);
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
