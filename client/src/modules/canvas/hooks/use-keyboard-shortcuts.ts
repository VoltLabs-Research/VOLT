import { useKeyboardShortcutsStore } from '../stores/use-keyboard-shortcuts-store';
import { useScreenshotStore } from '../stores/use-screenshot-store';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { resolveRangedTimesteps } from '@/modules/canvas/utilities/timeline-range';
import useCanvasUrlState from './use-canvas-url-state';

import { useEffect, useRef } from 'react';

const normalizeKey = (key: string): string => {
    const keyMap: Record<string, string> = {
        ' ': 'space',
        '+': '=',
        '_': '-',
        add: '=',
        subtract: '-'
    };
    const lower = key.toLowerCase();
    return keyMap[lower] ?? lower;
};

interface UseKeyboardShortcutsParams {
    trajectoryId?: string;
    currentTimestep: number | undefined;
    availableTimesteps: number[];
};

const useKeyboardShortcuts = ({
    trajectoryId,
    currentTimestep,
    availableTimesteps
}: UseKeyboardShortcutsParams) => {
    const shortcuts = useKeyboardShortcutsStore((s) => s.shortcuts);
    const showPanel = useKeyboardShortcutsStore((s) => s.showPanel);
    const currentScope = useKeyboardShortcutsStore((s) => s.currentScope);
    const setLastTriggered = useKeyboardShortcutsStore((s) => s.setLastTriggered);
    const togglePanel = useKeyboardShortcutsStore((s) => s.togglePanel);
    const setShowPanel = useKeyboardShortcutsStore((s) => s.setShowPanel);
    const {
        showWidgets,
        showGrid,
        showGizmo,
        updateSearchParams,
        setResultsPluginId,
    } = useCanvasUrlState();

    const actionsRef = useRef<Record<string, () => void>>({});
    const lastTriggeredTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        const getVisibleTimesteps = () => {
            const { rangeStart, rangeEnd } = useEditorStore.getState();
            return resolveRangedTimesteps(availableTimesteps, rangeStart, rangeEnd);
        };

        actionsRef.current = {
            'play-pause': () => {
                useEditorStore.getState().togglePlay({ trajectoryId, timesteps: availableTimesteps });
            },

            'frame-prev': () => {
                if (currentTimestep === undefined) return;
                const { setCurrentTimestep } = useEditorStore.getState();
                const timesteps = getVisibleTimesteps();
                const idx = timesteps.indexOf(currentTimestep);
                if (idx === -1) {
                    return;
                }

                if (idx > 0) {
                    setCurrentTimestep(timesteps[idx - 1]);
                }
            },

            'frame-next': () => {
                if (currentTimestep === undefined) return;
                const { setCurrentTimestep } = useEditorStore.getState();
                const timesteps = getVisibleTimesteps();
                const idx = timesteps.indexOf(currentTimestep);
                if (idx === -1) {
                    return;
                }

                if (idx < timesteps.length - 1) {
                    setCurrentTimestep(timesteps[idx + 1]);
                }
            },

            'frame-prev-10': () => {
                if (currentTimestep === undefined) return;
                const { setCurrentTimestep } = useEditorStore.getState();
                const timesteps = getVisibleTimesteps();
                const idx = timesteps.indexOf(currentTimestep);
                if (idx === -1) {
                    return;
                }

                const newIdx = Math.max(0, idx - 10);
                setCurrentTimestep(timesteps[newIdx]);
            },

            'frame-next-10': () => {
                if (currentTimestep === undefined) return;
                const { setCurrentTimestep } = useEditorStore.getState();
                const timesteps = getVisibleTimesteps();
                const idx = timesteps.indexOf(currentTimestep);
                if (idx === -1) {
                    return;
                }

                const newIdx = Math.min(timesteps.length - 1, idx + 10);
                setCurrentTimestep(timesteps[newIdx]);
            },

            'frame-first': () => {
                const { setCurrentTimestep } = useEditorStore.getState();
                const timesteps = getVisibleTimesteps();
                if (timesteps.length > 0) {
                    setCurrentTimestep(timesteps[0]);
                }
            },

            'frame-last': () => {
                const { setCurrentTimestep } = useEditorStore.getState();
                const timesteps = getVisibleTimesteps();
                if (timesteps.length > 0) {
                    setCurrentTimestep(timesteps[timesteps.length - 1]);
                }
            },

            'speed-up': () => {
                const { playSpeed, setPlaySpeed } = useEditorStore.getState();
                setPlaySpeed(Math.min(10, playSpeed + 0.5));
            },

            'speed-down': () => {
                const { playSpeed, setPlaySpeed } = useEditorStore.getState();
                setPlaySpeed(Math.max(0.1, playSpeed - 0.5));
            },

            'toggle-grid': () => {
                updateSearchParams({ grid: showGrid ? 'false' : null }, { replace: true });
            },

            'toggle-widgets': () => {
                updateSearchParams({ widgets: showWidgets ? 'false' : null }, { replace: true });
            },

            'toggle-gizmo': () => {
                updateSearchParams({ gizmo: showGizmo ? 'false' : null }, { replace: true });
            },

            'reset-camera': () => {
                window.dispatchEvent(new CustomEvent('Volt:camera-command', {
                    detail: { command: 'reset-camera' }
                }));
            },

            'increase-point-size': () => {
                useEditorStore.getState().increasePointSize();
            },

            'decrease-point-size': () => {
                useEditorStore.getState().decreasePointSize();
            },

            'show-shortcuts': togglePanel,
            'show-shortcuts-ctrl-k': togglePanel,

            'screenshot': () => {
                useScreenshotStore.getState().requestCapture();
            },

            'escape': () => {
                if (useKeyboardShortcutsStore.getState().showPanel) {
                    setShowPanel(false);
                    return;
                }
                setResultsPluginId(undefined, { replace: true });
            }
        };
    }, [
        togglePanel,
        setShowPanel,
        showWidgets,
        showGrid,
        showGizmo,
        trajectoryId,
        currentTimestep,
        availableTimesteps,
        updateSearchParams,
        setResultsPluginId
    ]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as Element;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
                if (e.key !== 'Escape') return;
            }

            if (target.getAttribute('contenteditable') === 'true') {
                if (e.key !== 'Escape') return;
            }

            const normalizedKey = normalizeKey(e.key);
            const isLetter = /^[a-z]$/.test(normalizedKey);
            const isSpecialKey = e.key.length > 1;

            const pressedKeys: string[] = [];
            if (e.ctrlKey) pressedKeys.push('ctrl');
            if (e.shiftKey && (isLetter || isSpecialKey)) pressedKeys.push('shift');
            if (e.altKey) pressedKeys.push('alt');
            if (e.metaKey) pressedKeys.push('meta');
            pressedKeys.push(normalizedKey);

            const currentShortcuts = useKeyboardShortcutsStore.getState().shortcuts;
            const scope = useKeyboardShortcutsStore.getState().currentScope;

            for (const [id, shortcut] of currentShortcuts) {
                if (shortcut.enabled === false) continue;

                if (shortcut.scope === 'canvas' && scope !== 'canvas') {
                    continue;
                }

                const matches =
                    shortcut.keys.length === pressedKeys.length &&
                    shortcut.keys.every((k) => pressedKeys.includes(k));

                if (matches) {
                    e.preventDefault();
                    e.stopPropagation();

                    const action = actionsRef.current[id];
                    if (action) {
                        action();
                    }

                    if (lastTriggeredTimeoutRef.current !== null) {
                        window.clearTimeout(lastTriggeredTimeoutRef.current);
                    }

                    setLastTriggered({ id, description: shortcut.description });
                    lastTriggeredTimeoutRef.current = window.setTimeout(() => {
                        setLastTriggered(null);
                        lastTriggeredTimeoutRef.current = null;
                    }, 1500);

                    return;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => {
            window.removeEventListener('keydown', handleKeyDown, { capture: true });
            if (lastTriggeredTimeoutRef.current !== null) {
                window.clearTimeout(lastTriggeredTimeoutRef.current);
                lastTriggeredTimeoutRef.current = null;
            }
            setLastTriggered(null);
        };
    }, [setLastTriggered]);

    return {
        shortcuts,
        showPanel,
        currentScope,
        togglePanel
    };
};

export default useKeyboardShortcuts;
