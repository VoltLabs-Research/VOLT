import { useEffect, useRef } from 'react';
import { useKeyboardShortcutsStore } from '@/shared/presentation/stores/use-keyboard-shortcuts-store';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import useCanvasUIStore from '@/modules/canvas/presentation/stores/use-canvas-ui-store';

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
                const { grid } = useEditorStore.getState();
                grid.setEnabled(!grid.enabled);
            },

            'toggle-widgets': () => {
                useCanvasUIStore.getState().toggleEditorWidgets();
            },

            'reset-camera': () => {
                window.dispatchEvent(new CustomEvent('Volt:camera-command', {
                    detail: { command: 'reset-camera' }
                }));
            },

            'color-coding': () => {
                useCanvasUIStore.getState().toggleModifier('color-coding');
            },

            'slice-plane': () => {
                useCanvasUIStore.getState().toggleModifier('slice-plane');
            },

            'particle-filter': () => {
                useCanvasUIStore.getState().toggleModifier('particle-filter');
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
                useCanvasUIStore.getState().closeResultsViewer();
            },

            'toggle-opacity-settings': () => {
                const { activeScene } = useEditorStore.getState();
                const { exposureSettingsScene, openExposureSettings, closeExposureSettings } = useCanvasUIStore.getState();

                if (!activeScene) return;

                const areScenesEqual = (scene1: any, scene2: any): boolean => {
                    if (!scene1 || !scene2) return false;
                    if (scene1.source !== scene2.source) return false;
                    if (scene1.sceneType !== scene2.sceneType) return false;
                    if (scene1.source === 'plugin') {
                        return scene1.analysisId === scene2.analysisId &&
                               scene1.exposureId === scene2.exposureId;
                    }
                    return true;
                };

                if (exposureSettingsScene && areScenesEqual(activeScene, exposureSettingsScene)) {
                    closeExposureSettings();
                } else {
                    openExposureSettings(activeScene);
                }
            }
        };
    }, [togglePanel, setShowPanel]);

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
