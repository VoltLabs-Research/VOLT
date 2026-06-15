import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { isPointInBox, isPointInLasso, boxFromCorners } from '@/modules/fractal/utilities/selection-geometry';
import type { FractalEngine } from '@/modules/fractal/services/fractal-engine';
import type { OrbitControlsHandle } from '@/modules/fractal/types';
import type { SelectionBox, SelectionLasso } from '@/modules/fractal/types/scene-config';
import type { AtomColumnView } from '@/modules/trajectory/api/services/trajectory-service';
import type { MutableRefObject, RefObject } from 'react';

interface UseAtomPickParams {
    engineRef: MutableRefObject<{ readPickAtPixel: FractalEngine['readPickAtPixel']; projectAtomsToScreen: FractalEngine['projectAtomsToScreen'] } | null>;
    selectionKey: string | null;
    ids: AtomColumnView['values'] | null;
    enabled: boolean;
    allowLassoBox: boolean;
    orbitControlsRef?: RefObject<OrbitControlsHandle | null>;
}

// A pointer that moved less than this (CSS px) between down and up is a click,
// not a drag — so a click-pick is not swallowed by an incidental orbit nudge.
const CLICK_SLOP_PX = 4;

type GestureMode = 'click' | 'lasso' | 'box';

interface ActiveGesture {
    mode: GestureMode;
    startX: number;
    startY: number;
    additive: boolean;
    subtractive: boolean;
    lassoPoints: Array<[number, number]>;
    boxEnd: [number, number];
    moved: boolean;
}

const LASSO_STROKE = 'rgba(255, 212, 0, 0.95)';
const LASSO_FILL = 'rgba(255, 212, 0, 0.12)';

const toAtomId = (ids: AtomColumnView['values'], index: number): number => Number(ids[index]);

/**
 * Binds the scene canvas to GPU pick + screen-space lasso/box selection and
 * writes the result to the per-frame selection store. Mounted once per atom
 * point-cloud scene (in SingleModelViewer); the highlight effect there reflects
 * the store back into the 3D view, and the atom table mirrors the same store —
 * the store is the only coupling between the two surfaces.
 *
 * Gestures (left button):
 *   - click               → toggle the picked atom
 *   - Shift+click         → add the picked atom
 *   - Ctrl/Cmd+click      → remove the picked atom
 *   - Alt+drag            → lasso: replace selection with enclosed atoms
 *   - Shift+Alt+drag      → box: add enclosed atoms to the selection
 *
 * Visual feedback during a drag is a 2D overlay canvas laid over the WebGL
 * canvas (plan risk #3) — purely cosmetic, created and torn down per drag.
 */
const useAtomPick = ({
    engineRef,
    selectionKey,
    ids,
    enabled,
    allowLassoBox,
    orbitControlsRef
}: UseAtomPickParams): void => {
    const domElement = useThree((state) => state.gl.domElement);

    // Latest inputs without re-binding listeners on every render.
    const stateRef = useRef({ selectionKey, ids, enabled, allowLassoBox });
    stateRef.current = { selectionKey, ids, enabled, allowLassoBox };

    const gestureRef = useRef<ActiveGesture | null>(null);
    const overlayRef = useRef<HTMLCanvasElement | null>(null);
    const orbitWasEnabledRef = useRef<boolean | null>(null);

    useEffect(() => {
        const canvas = domElement;
        const parent = canvas.parentElement;
        if (!parent) return;

        const canvasPoint = (event: PointerEvent): [number, number] => {
            const rect = canvas.getBoundingClientRect();
            return [event.clientX - rect.left, event.clientY - rect.top];
        };

        const ensureOverlay = (): CanvasRenderingContext2D | null => {
            const rect = canvas.getBoundingClientRect();
            let overlay = overlayRef.current;
            if (!overlay) {
                overlay = document.createElement('canvas');
                overlay.style.position = 'absolute';
                overlay.style.left = '0';
                overlay.style.top = '0';
                overlay.style.width = '100%';
                overlay.style.height = '100%';
                overlay.style.pointerEvents = 'none';
                overlay.style.zIndex = '5';
                parent.appendChild(overlay);
                overlayRef.current = overlay;
            }
            overlay.width = Math.max(1, Math.round(rect.width));
            overlay.height = Math.max(1, Math.round(rect.height));
            return overlay.getContext('2d');
        };

        const clearOverlay = () => {
            const overlay = overlayRef.current;
            if (overlay) {
                overlay.remove();
                overlayRef.current = null;
            }
        };

        const drawGesture = (gesture: ActiveGesture) => {
            const ctx = ensureOverlay();
            if (!ctx) return;
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = LASSO_STROKE;
            ctx.fillStyle = LASSO_FILL;
            if (gesture.mode === 'box') {
                const box = boxFromCorners(gesture.startX, gesture.startY, gesture.boxEnd[0], gesture.boxEnd[1]);
                ctx.beginPath();
                ctx.rect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);
                ctx.fill();
                ctx.stroke();
                return;
            }
            if (gesture.mode === 'lasso' && gesture.lassoPoints.length > 1) {
                ctx.beginPath();
                ctx.moveTo(gesture.lassoPoints[0][0], gesture.lassoPoints[0][1]);
                for (let i = 1; i < gesture.lassoPoints.length; i += 1) {
                    ctx.lineTo(gesture.lassoPoints[i][0], gesture.lassoPoints[i][1]);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        };

        const setOrbitEnabled = (value: boolean) => {
            const controls = orbitControlsRef?.current;
            if (!controls) return;
            controls.enabled = value;
        };

        // Project every atom once and collect the ids whose screen position
        // satisfies the predicate. O(n) in the frame's atom count; gated to
        // <= LASSO_BOX_ATOM_CAP atoms by the caller (plan risk #2).
        const collectAtomsInRegion = (predicate: (x: number, y: number) => boolean): Set<number> => {
            const result = new Set<number>();
            const { ids: idBuffer } = stateRef.current;
            const engine = engineRef.current;
            if (!engine || !idBuffer) return result;
            const projected = engine.projectAtomsToScreen();
            if (!projected) return result;
            const atomCount = Math.min(idBuffer.length, projected.length >> 1);
            for (let index = 0; index < atomCount; index += 1) {
                const x = projected[index * 2];
                const y = projected[index * 2 + 1];
                if (Number.isNaN(x) || Number.isNaN(y)) continue;
                if (predicate(x, y)) result.add(toAtomId(idBuffer, index));
            }
            return result;
        };

        const commitClick = (gesture: ActiveGesture, x: number, y: number) => {
            const { selectionKey: key, ids: idBuffer } = stateRef.current;
            const engine = engineRef.current;
            if (!engine || !key || !idBuffer) return;
            const index = engine.readPickAtPixel(x, y);
            if (index === null || index < 0 || index >= idBuffer.length) return;
            const atomId = toAtomId(idBuffer, index);
            const store = useEditorStore.getState();
            if (gesture.additive) {
                store.addAtomSelection(key, [atomId]);
            } else if (gesture.subtractive) {
                store.removeAtomSelection(key, [atomId]);
            } else {
                store.toggleAtomSelection(key, atomId);
            }
        };

        const commitLasso = (gesture: ActiveGesture) => {
            const { selectionKey: key } = stateRef.current;
            if (!key) return;
            const lasso: SelectionLasso = { points: gesture.lassoPoints, closed: true };
            const matching = collectAtomsInRegion((x, y) => isPointInLasso(x, y, lasso));
            useEditorStore.getState().setAtomSelection(key, matching);
        };

        const commitBox = (gesture: ActiveGesture) => {
            const { selectionKey: key } = stateRef.current;
            if (!key) return;
            const box: SelectionBox = boxFromCorners(gesture.startX, gesture.startY, gesture.boxEnd[0], gesture.boxEnd[1]);
            const matching = collectAtomsInRegion((x, y) => isPointInBox(x, y, box));
            // Shift+Alt box is additive (DoD), so merge with the existing set.
            useEditorStore.getState().addAtomSelection(key, matching);
        };

        const endGesture = (event: PointerEvent) => {
            const gesture = gestureRef.current;
            gestureRef.current = null;
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            if (orbitWasEnabledRef.current !== null) {
                setOrbitEnabled(orbitWasEnabledRef.current);
                orbitWasEnabledRef.current = null;
            }
            clearOverlay();
            if (!gesture) return;

            const [x, y] = canvasPoint(event);
            if (gesture.mode === 'click') {
                const dx = x - gesture.startX;
                const dy = y - gesture.startY;
                if (Math.hypot(dx, dy) <= CLICK_SLOP_PX) commitClick(gesture, x, y);
                return;
            }
            if (gesture.mode === 'lasso') {
                if (gesture.lassoPoints.length >= 3) commitLasso(gesture);
                return;
            }
            if (gesture.moved) commitBox(gesture);
        };

        function handlePointerMove(event: PointerEvent) {
            const gesture = gestureRef.current;
            if (!gesture) return;
            const [x, y] = canvasPoint(event);
            gesture.moved = true;
            if (gesture.mode === 'lasso') {
                gesture.lassoPoints.push([x, y]);
                drawGesture(gesture);
            } else if (gesture.mode === 'box') {
                gesture.boxEnd = [x, y];
                drawGesture(gesture);
            }
        }

        function handlePointerUp(event: PointerEvent) {
            endGesture(event);
        }

        const handlePointerDown = (event: PointerEvent) => {
            const { enabled: isEnabled, allowLassoBox: canLassoBox, selectionKey: key } = stateRef.current;
            if (!isEnabled || !key || event.button !== 0) return;

            const wantsLassoBox = event.altKey && canLassoBox;
            const [x, y] = canvasPoint(event);

            let mode: GestureMode = 'click';
            if (wantsLassoBox) mode = event.shiftKey ? 'box' : 'lasso';

            const gesture: ActiveGesture = {
                mode,
                startX: x,
                startY: y,
                // Lasso/box carry the Alt modifier, so Shift there selects "box"
                // rather than "add"; additive/subtractive only apply to clicks.
                additive: mode === 'click' && event.shiftKey,
                subtractive: mode === 'click' && (event.ctrlKey || event.metaKey),
                lassoPoints: mode === 'lasso' ? [[x, y]] : [],
                boxEnd: [x, y],
                moved: false
            };
            gestureRef.current = gesture;

            if (mode !== 'click') {
                // Stop OrbitControls from rotating/panning under the selection drag.
                const controls = orbitControlsRef?.current;
                orbitWasEnabledRef.current = controls ? controls.enabled : null;
                setOrbitEnabled(false);
                event.preventDefault();
                event.stopPropagation();
            }

            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
        };

        canvas.addEventListener('pointerdown', handlePointerDown);
        return () => {
            canvas.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            if (orbitWasEnabledRef.current !== null) {
                setOrbitEnabled(orbitWasEnabledRef.current);
                orbitWasEnabledRef.current = null;
            }
            clearOverlay();
            gestureRef.current = null;
        };
    }, [domElement, engineRef, orbitControlsRef]);
};

export default useAtomPick;
