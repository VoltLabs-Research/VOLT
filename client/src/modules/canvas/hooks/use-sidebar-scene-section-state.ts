import { useCallback, useState } from 'react';

export interface SidebarSceneSectionSnapshot {
    expandedSections: Set<string>;
    headerPopoverStates: Map<string, boolean>;
}

/**
 * Per-analysis UI state of the canvas sidebar: which sections are expanded and
 * which header popovers are open. Snapshot/restore exists so an optimistic
 * analysis delete can put this state back if the request fails.
 */
const useSidebarSceneSectionState = () => {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [headerPopoverStates, setHeaderPopoverStates] = useState<Map<string, boolean>>(new Map());

    const reset = useCallback(() => {
        setExpandedSections(new Set());
        setHeaderPopoverStates(new Map());
    }, []);

    const expandSection = useCallback((analysisId: string) => {
        setExpandedSections((current) => {
            if (current.has(analysisId)) return current;
            const next = new Set(current);
            next.add(analysisId);
            return next;
        });
    }, []);

    const toggleSection = useCallback((analysisId: string) => {
        setExpandedSections((current) => {
            const next = new Set(current);
            if (next.has(analysisId)) next.delete(analysisId);
            else next.add(analysisId);
            return next;
        });
    }, []);

    const setHeaderPopoverOpen = useCallback((analysisId: string, isOpen: boolean) => {
        setHeaderPopoverStates((current) => new Map(current).set(analysisId, isOpen));
    }, []);

    const forgetAnalysis = useCallback((analysisId: string) => {
        setExpandedSections((current) => {
            if (!current.has(analysisId)) return current;
            const next = new Set(current);
            next.delete(analysisId);
            return next;
        });
        setHeaderPopoverStates((current) => {
            if (!current.has(analysisId)) return current;
            const next = new Map(current);
            next.delete(analysisId);
            return next;
        });
    }, []);

    const snapshot = (): SidebarSceneSectionSnapshot => ({
        expandedSections: new Set(expandedSections),
        headerPopoverStates: new Map(headerPopoverStates)
    });

    const restore = useCallback((previous: SidebarSceneSectionSnapshot) => {
        setExpandedSections(new Set(previous.expandedSections));
        setHeaderPopoverStates(new Map(previous.headerPopoverStates));
    }, []);

    return {
        expandedSections,
        headerPopoverStates,
        reset,
        expandSection,
        toggleSection,
        setHeaderPopoverOpen,
        forgetAnalysis,
        snapshot,
        restore
    };
};

export default useSidebarSceneSectionState;

export type SidebarSceneSectionState = ReturnType<typeof useSidebarSceneSectionState>;
