import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { applySearchParamUpdates } from '@/shared/presentation/hooks/use-search-params';
import { buildAtomSelectionKey } from '@/modules/canvas/utilities/atom-selection-key';

interface UseAtomSelectionLinkParams {
    trajectoryId: string | undefined;
    timestep: number | undefined;
}

interface RowModifiers {
    shift?: boolean;
    ctrl?: boolean;
}

interface UseAtomSelectionLinkResult {
    selectionKey: string | null;
    selectedIds: Set<number>;
    isRowSelected: (atomId: number) => boolean;
    onRowClick: (atomId: number, modifiers?: RowModifiers) => void;
    clear: () => void;
}

const SELECTION_PARAM = 'selectedAtomIds';

// Deep-linkable only while the selection is small enough to keep the URL sane
// (plan risk #6). Beyond this the param is dropped and the selection stays
// session-local; picking still works, the URL just stops mirroring it.
const URL_SELECTION_CAP = 1000;

const parseSelectionParam = (raw: string | null): Set<number> => {
    const result = new Set<number>();
    if (!raw) return result;
    for (const token of raw.split(',')) {
        const value = Number(token);
        if (Number.isFinite(value)) result.add(value);
    }
    return result;
};

const serializeSelection = (ids: Set<number>): string | null => {
    if (ids.size === 0 || ids.size > URL_SELECTION_CAP) return null;
    return Array.from(ids).sort((a, b) => a - b).join(',');
};

/**
 * Single source of truth for atom selection at the React layer. Bridges the
 * per-frame selection store to:
 *   - the atom table (isRowSelected / onRowClick, keyed by the frame-stable id);
 *   - the URL (`?selectedAtomIds=…`), so a selection is shareable and restores
 *     on load (T7.10).
 *
 * The 3D viewer reads/writes the same store directly (via useAtomPick and the
 * highlight effect), so table ↔ 3D linking is automatic — neither side calls
 * the other; they converge through the store.
 */
export const useAtomSelectionLink = ({
    trajectoryId,
    timestep
}: UseAtomSelectionLinkParams): UseAtomSelectionLinkResult => {
    const [searchParams, setSearchParams] = useSearchParams();
    const selectionKey = useMemo(() => buildAtomSelectionKey(trajectoryId, timestep), [trajectoryId, timestep]);

    const { atomSelectionByFrame, setAtomSelection, toggleAtomSelection, addAtomSelection, removeAtomSelection, clearAtomSelection } = useEditorStore(useShallow((state) => ({
        atomSelectionByFrame: state.atomSelectionByFrame,
        setAtomSelection: state.setAtomSelection,
        toggleAtomSelection: state.toggleAtomSelection,
        addAtomSelection: state.addAtomSelection,
        removeAtomSelection: state.removeAtomSelection,
        clearAtomSelection: state.clearAtomSelection
    })));

    const selectedIds = useMemo(
        () => (selectionKey ? atomSelectionByFrame.get(selectionKey) ?? new Set<number>() : new Set<number>()),
        [atomSelectionByFrame, selectionKey]
    );

    // Hydrate from the URL once per frame key. Tracks the last key we hydrated so
    // navigating to a new frame re-reads its param, but our own URL writes (which
    // change searchParams) do not re-trigger hydration.
    const hydratedKeyRef = useRef<string | null>(null);
    useEffect(() => {
        if (!selectionKey || hydratedKeyRef.current === selectionKey) return;
        hydratedKeyRef.current = selectionKey;
        const fromUrl = parseSelectionParam(searchParams.get(SELECTION_PARAM));
        if (fromUrl.size > 0) setAtomSelection(selectionKey, fromUrl);
    }, [selectionKey, searchParams, setAtomSelection]);

    // Mirror selection → URL (replace, so it does not spam history). Only once
    // hydration for this frame has run, so we never clobber an incoming deep link.
    useEffect(() => {
        if (!selectionKey || hydratedKeyRef.current !== selectionKey) return;
        const serialized = serializeSelection(selectedIds);
        const current = searchParams.get(SELECTION_PARAM);
        if (serialized === current) return;
        setSearchParams((prev) => applySearchParamUpdates(prev, { [SELECTION_PARAM]: serialized }), { replace: true });
    }, [selectionKey, selectedIds, searchParams, setSearchParams]);

    const isRowSelected = useCallback((atomId: number) => selectedIds.has(atomId), [selectedIds]);

    const onRowClick = useCallback((atomId: number, modifiers?: RowModifiers) => {
        if (!selectionKey) return;
        if (modifiers?.shift) {
            addAtomSelection(selectionKey, [atomId]);
        } else if (modifiers?.ctrl) {
            removeAtomSelection(selectionKey, [atomId]);
        } else {
            toggleAtomSelection(selectionKey, atomId);
        }
    }, [selectionKey, addAtomSelection, removeAtomSelection, toggleAtomSelection]);

    const clear = useCallback(() => {
        if (selectionKey) clearAtomSelection(selectionKey);
    }, [selectionKey, clearAtomSelection]);

    return { selectionKey, selectedIds, isRowSelected, onRowClick, clear };
};
