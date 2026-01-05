/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { useEffect, useRef } from 'react';
import { useKeyboardShortcutsStore } from '@/stores/slices/ui/keyboard-shortcuts-slice';
import { useEditorStore } from '@/stores/slices/editor';
import { useUIStore } from '@/stores/slices/ui';

/**
 * Normalize key names from KeyboardEvent.key to our shortcut format
 */
const normalizeKey = (key: string): string => {
    const keyMap: Record<string, string> = {
        ' ': 'space',
        'arrowleft': 'arrowleft',
        'arrowright': 'arrowright',
        'arrowup': 'arrowup',
        'arrowdown': 'arrowdown',
    };
    const lower = key.toLowerCase();
    return keyMap[lower] ?? lower;
};

/**
 * Hook that sets up keyboard shortcuts for the canvas editor.
 * Must be used within the Canvas page to connect shortcuts to editor actions.
 */
const useKeyboardShortcuts = () => {
    const shortcuts = useKeyboardShortcutsStore((s) => s.shortcuts);
    const showPanel = useKeyboardShortcutsStore((s) => s.showPanel);
    const currentScope = useKeyboardShortcutsStore((s) => s.currentScope);
    const setLastTriggered = useKeyboardShortcutsStore((s) => s.setLastTriggered);
    const togglePanel = useKeyboardShortcutsStore((s) => s.togglePanel);
    const setShowPanel = useKeyboardShortcutsStore((s) => s.setShowPanel);

    // Use refs to always have latest action implementations
    const actionsRef = useRef<Record<string, () => void>>({});

    // Define all actions
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
                useUIStore.getState().toggleEditorWidgets();
            },

            'reset-camera': () => {
                // Dispatch custom event for Scene3D to handle
                window.dispatchEvent(new CustomEvent('volterra:camera-command', {
                    detail: { command: 'reset-camera' }
                }));
            },

            'color-coding': () => {
                // Toggle color coding modifier
                useUIStore.getState().toggleModifier('color-coding');
            },

            'slice-plane': () => {
                // Toggle slice plane modifier
                useUIStore.getState().toggleModifier('slice-plane');
            },

            'particle-filter': () => {
                // Toggle particle filter modifier
                useUIStore.getState().toggleModifier('particle-filter');
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
                // Close shortcuts panel if open
                if (useKeyboardShortcutsStore.getState().showPanel) {
                    setShowPanel(false);
                    return;
                }
                // Close other UI elements as needed
                useUIStore.getState().closeResultsViewer();
            },
        };
    }, [togglePanel, setShowPanel]);

    // Global keyboard listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip if user is typing in an input
            const target = e.target as Element;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
                // Only handle Escape in inputs
                if (e.key !== 'Escape') return;
            }

            // Skip if contenteditable
            if (target.getAttribute('contenteditable') === 'true') {
                if (e.key !== 'Escape') return;
            }

            // Build array of pressed keys (normalized)
            const pressedKeys: string[] = [];
            if (e.ctrlKey) pressedKeys.push('ctrl');
            if (e.shiftKey) pressedKeys.push('shift');
            if (e.altKey) pressedKeys.push('alt');
            if (e.metaKey) pressedKeys.push('meta');

            const normalizedKey = normalizeKey(e.key);
            pressedKeys.push(normalizedKey);

            // Get current state
            const currentShortcuts = useKeyboardShortcutsStore.getState().shortcuts;
            const scope = useKeyboardShortcutsStore.getState().currentScope;

            // Find matching shortcut
            for (const [id, shortcut] of currentShortcuts) {
                // Check if shortcut is enabled
                if (shortcut.enabled === false) continue;

                // Check scope - allow global shortcuts always, and canvas shortcuts when in canvas
                if (shortcut.scope === 'canvas' && scope !== 'canvas') {
                    continue;
                }

                // Check if keys match
                const matches =
                    shortcut.keys.length === pressedKeys.length &&
                    shortcut.keys.every(k => pressedKeys.includes(k));

                if (matches) {
                    e.preventDefault();
                    e.stopPropagation();

                    // Execute action from ref (always up-to-date)
                    const action = actionsRef.current[id];
                    if (action) {
                        action();
                    }

                    // Show visual feedback
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
