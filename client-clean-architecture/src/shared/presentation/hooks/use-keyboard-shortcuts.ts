import { useEffect, useRef } from 'react';
import { useKeyboardShortcutsStore } from '@/shared/presentation/stores/use-keyboard-shortcuts-store';
import { useEditorStore } from '@/modules/fractal/presentation/stores/editor';
import { useSearchParams } from 'react-router-dom';

const normalizeKey = (key: string): string => {
    const keyMap: Record<string, string> = {
        ' ': 'space',
        'arrowleft': 'arrowleft',
        'arrowright': 'arrowright',
        'arrowup': 'arrowup',
        'arrowdown': 'arrowdown'
    };
    const lower = key.toLowerCase();
    return keyMap[lower] ?? lower;
};

const useKeyboardShortcuts = () => {
    const shortcuts = useKeyboardShortcutsStore((s) => s.shortcuts);
    const showPanel = useKeyboardShortcutsStore((s) => s.showPanel);
    const currentScope = useKeyboardShortcutsStore((s) => s.currentScope);
    const setLastTriggered = useKeyboardShortcutsStore((s) => s.setLastTriggered);
    const togglePanel = useKeyboardShortcutsStore((s) => s.togglePanel);
    const setShowPanel = useKeyboardShortcutsStore((s) => s.setShowPanel);
    const [, setSearchParams] = useSearchParams();

    const actionsRef = useRef<Record<string, () => void>>({});

    useEffect(() => {
        actionsRef.current = {
            'play-pause': () => {
                useEditorStore.getState().togglePlay();
            },

            'frame-prev': () => {
                const { currentTimestep, timestepData, setCurrentTimestep } = useEditorStore.getState();
                if (currentTimestep === undefined) return;
                const idx = timestepData.timesteps.indexOf(currentTimestep);
                if (idx > 0) {
                    setCurrentTimestep(timestepData.timesteps[idx - 1]);
                }
            },

            'frame-next': () => {
                const { currentTimestep, timestepData, setCurrentTimestep } = useEditorStore.getState();
                if (currentTimestep === undefined) return;
                const idx = timestepData.timesteps.indexOf(currentTimestep);
                if (idx < timestepData.timesteps.length - 1) {
                    setCurrentTimestep(timestepData.timesteps[idx + 1]);
                }
            },

            'frame-prev-10': () => {
                const { currentTimestep, timestepData, setCurrentTimestep } = useEditorStore.getState();
                if (currentTimestep === undefined) return;
                const idx = timestepData.timesteps.indexOf(currentTimestep);
                const newIdx = Math.max(0, idx - 10);
                setCurrentTimestep(timestepData.timesteps[newIdx]);
            },

            'frame-next-10': () => {
                const { currentTimestep, timestepData, setCurrentTimestep } = useEditorStore.getState();
                if (currentTimestep === undefined) return;
                const idx = timestepData.timesteps.indexOf(currentTimestep);
                const newIdx = Math.min(timestepData.timesteps.length - 1, idx + 10);
                setCurrentTimestep(timestepData.timesteps[newIdx]);
            },

            'frame-first': () => {
                const { timestepData, setCurrentTimestep } = useEditorStore.getState();
                if (timestepData.timesteps.length > 0) {
                    setCurrentTimestep(timestepData.timesteps[0]);
                }
            },

            'frame-last': () => {
                const { timestepData, setCurrentTimestep } = useEditorStore.getState();
                if (timestepData.timesteps.length > 0) {
                    setCurrentTimestep(timestepData.timesteps[timestepData.timesteps.length - 1]);
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
                window.dispatchEvent(new CustomEvent('Volt:toggle-grid'));
            },

            'toggle-widgets': () => {
                window.dispatchEvent(new CustomEvent('Volt:toggle-widgets'));
            },

            'reset-camera': () => {
                window.dispatchEvent(new CustomEvent('Volt:camera-command', {
                    detail: { command: 'reset-camera' }
                }));
            },

            'color-coding': () => {
                window.dispatchEvent(new CustomEvent('Volt:toggle-modifier', { detail: { modifier: 'color-coding' } }));
            },

            'slice-plane': () => {
                window.dispatchEvent(new CustomEvent('Volt:toggle-modifier', { detail: { modifier: 'slice-plane' } }));
            },

            'particle-filter': () => {
                window.dispatchEvent(new CustomEvent('Volt:toggle-modifier', { detail: { modifier: 'particle-filter' } }));
            },

            'increase-point-size': () => {
                useEditorStore.getState().increasePointSize();
            },

            'decrease-point-size': () => {
                useEditorStore.getState().decreasePointSize();
            },

            'show-shortcuts': () => {
                togglePanel();
            },

            'escape': () => {
                if (useKeyboardShortcutsStore.getState().showPanel) {
                    setShowPanel(false);
                    return;
                }
                setSearchParams((prev) => {
                    prev.delete('results');
                    return prev;
                }, { replace: true });
            },

            'toggle-opacity-settings': () => {
                const { activeScene } = useEditorStore.getState();
                if (!activeScene) return;

                const key = activeScene.source === 'plugin'
                    ? `plugin:${activeScene.analysisId}:${activeScene.exposureId}`
                    : `${activeScene.source}:${activeScene.sceneType}`;

                setSearchParams((prev) => {
                    if (prev.get('settings') === key) {
                        prev.delete('settings');
                    } else {
                        prev.set('settings', key);
                    }
                    return prev;
                }, { replace: true });
            }
        };
    }, [togglePanel, setShowPanel, setSearchParams]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as Element;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
                if (e.key !== 'Escape') return;
            }

            if (target.getAttribute('contenteditable') === 'true') {
                if (e.key !== 'Escape') return;
            }

            const pressedKeys: string[] = [];
            if (e.ctrlKey) pressedKeys.push('ctrl');
            if (e.shiftKey) pressedKeys.push('shift');
            if (e.altKey) pressedKeys.push('alt');
            if (e.metaKey) pressedKeys.push('meta');

            const normalizedKey = normalizeKey(e.key);
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

                    setLastTriggered({ id, description: shortcut.description });
                    setTimeout(() => setLastTriggered(null), 1500);

                    return;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => {
            window.removeEventListener('keydown', handleKeyDown, { capture: true });
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
