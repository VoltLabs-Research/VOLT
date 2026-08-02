import {
    EDITOR_GROUP_IDS,
    PRIMARY_EDITOR_GROUP_ID,
    SECONDARY_EDITOR_GROUP_ID,
    createEditorGroup,
    getNextSelectionAfterClose,
    isSameSelection,
    isSameTab,
    isTexFile
} from '@/modules/latex/hooks/workspace/editor-helpers';
import { confirmAction, ConfirmActionTone } from '@/shared/ui/hooks/use-confirm';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
    FileEditorState,
    LatexEditorGroup,
    LatexEditorGroupId,
    LatexWorkspaceTab
} from '@/modules/latex/contracts/workspace';
import type { LatexAsset, LatexFile } from '@volt/contracts/modules/latex/domain';

interface UseLatexEditorGroupsInput{
    files: LatexFile[];
    assets: LatexAsset[];
    fileEditorStatesRef: { current: Record<string, FileEditorState> };
}

/**
 * The tab bar and split view as a state machine: which tabs are open in each
 * editor group, which one is selected, and which group has focus.
 *
 * Tabs can outlive the entity they point at (a collaborator deletes a file, an
 * upload replaces one), so open tabs are pruned against the current file and
 * asset lists rather than trusted.
 */
const useLatexEditorGroups = ({ files, assets, fileEditorStatesRef }: UseLatexEditorGroupsInput) => {
    const [editorGroupsState, setEditorGroupsState] = useState<Record<LatexEditorGroupId, LatexEditorGroup>>({
        [PRIMARY_EDITOR_GROUP_ID]: createEditorGroup(PRIMARY_EDITOR_GROUP_ID),
        [SECONDARY_EDITOR_GROUP_ID]: createEditorGroup(SECONDARY_EDITOR_GROUP_ID)
    });
    const [activeEditorGroupId, setActiveEditorGroupId] = useState<LatexEditorGroupId>(PRIMARY_EDITOR_GROUP_ID);
    const [isEditorSplit, setIsEditorSplit] = useState(false);
    const hasBootstrappedSelectionRef = useRef(false);

    const updateEditorGroup = useCallback((
        groupId: LatexEditorGroupId,
        updater: (group: LatexEditorGroup) => LatexEditorGroup
    ): void => {
        setEditorGroupsState((currentGroups) => ({
            ...currentGroups,
            [groupId]: updater(currentGroups[groupId])
        }));
    }, []);

    const handleOpenTab = useCallback((tab: LatexWorkspaceTab, targetGroupId: LatexEditorGroupId = activeEditorGroupId): void => {
        hasBootstrappedSelectionRef.current = true;
        updateEditorGroup(targetGroupId, (group) => ({
            ...group,
            openTabs: group.openTabs.some((currentTab) => isSameTab(currentTab, tab))
                ? group.openTabs
                : [...group.openTabs, tab],
            selection: tab
        }));
        setActiveEditorGroupId(targetGroupId);
    }, [activeEditorGroupId, updateEditorGroup]);

    const handleSelectTab = useCallback((groupId: LatexEditorGroupId, tab: LatexWorkspaceTab): void => {
        updateEditorGroup(groupId, (group) => ({
            ...group,
            selection: tab
        }));
        setActiveEditorGroupId(groupId);
    }, [updateEditorGroup]);

    const handleCloseTab = useCallback(async (groupId: LatexEditorGroupId, tabToClose: LatexWorkspaceTab): Promise<void> => {
        if (tabToClose.type === 'file' && fileEditorStatesRef.current[tabToClose.id]?.isDirty) {
            const confirmed = await confirmAction({
                title: 'Discard unsaved changes?',
                description: 'This file has changes that have not been saved yet. Closing the tab will discard them.',
                confirmText: 'Close anyway',
                tone: ConfirmActionTone.Danger
            });

            if (!confirmed) {
                return;
            }
        }

        updateEditorGroup(groupId, (group) => ({
            ...group,
            openTabs: group.openTabs.filter((currentTab) => !isSameTab(currentTab, tabToClose)),
            selection: getNextSelectionAfterClose(group.openTabs, tabToClose, group.selection)
        }));
    }, [fileEditorStatesRef, updateEditorGroup]);

    const handleFocusEditorGroup = useCallback((groupId: LatexEditorGroupId): void => {
        setActiveEditorGroupId(groupId);
    }, []);

    const handleDuplicateTabToGroup = useCallback((tab: LatexWorkspaceTab, targetGroupId: LatexEditorGroupId): void => {
        setIsEditorSplit((currentValue) => currentValue || targetGroupId === SECONDARY_EDITOR_GROUP_ID);
        handleOpenTab(tab, targetGroupId);
    }, [handleOpenTab]);

    const handleSplitEditorDown = useCallback((tab?: LatexWorkspaceTab): void => {
        const sourceTab = tab ?? editorGroupsState[activeEditorGroupId].selection;
        if (!sourceTab) {
            return;
        }

        handleDuplicateTabToGroup(sourceTab, SECONDARY_EDITOR_GROUP_ID);
    }, [activeEditorGroupId, editorGroupsState, handleDuplicateTabToGroup]);

    const handleDuplicateTabToOtherGroup = useCallback((groupId: LatexEditorGroupId, tab: LatexWorkspaceTab): void => {
        handleDuplicateTabToGroup(tab, groupId === PRIMARY_EDITOR_GROUP_ID
            ? SECONDARY_EDITOR_GROUP_ID
            : PRIMARY_EDITOR_GROUP_ID);
    }, [handleDuplicateTabToGroup]);

    /** Closing the split folds the secondary group's tabs back into the primary one. */
    const handleCloseSecondaryEditorGroup = useCallback((): void => {
        setEditorGroupsState((currentGroups) => {
            const primaryGroup = currentGroups[PRIMARY_EDITOR_GROUP_ID];
            const secondaryGroup = currentGroups[SECONDARY_EDITOR_GROUP_ID];
            const nextPrimaryTabs = [...primaryGroup.openTabs];

            for (const tab of secondaryGroup.openTabs) {
                if (!nextPrimaryTabs.some((currentTab) => isSameTab(currentTab, tab))) {
                    nextPrimaryTabs.push(tab);
                }
            }

            return {
                ...currentGroups,
                [PRIMARY_EDITOR_GROUP_ID]: {
                    ...primaryGroup,
                    openTabs: nextPrimaryTabs,
                    selection: primaryGroup.selection ?? secondaryGroup.selection ?? nextPrimaryTabs[nextPrimaryTabs.length - 1] ?? null
                },
                [SECONDARY_EDITOR_GROUP_ID]: createEditorGroup(SECONDARY_EDITOR_GROUP_ID)
            };
        });

        setIsEditorSplit(false);
        setActiveEditorGroupId(PRIMARY_EDITOR_GROUP_ID);
    }, []);

    const handleReorderTabs = useCallback((
        groupId: LatexEditorGroupId,
        activeTab: LatexWorkspaceTab,
        overTab: LatexWorkspaceTab | null,
        position: 'before' | 'after' | 'end'
    ): void => {
        updateEditorGroup(groupId, (group) => {
            if (overTab && isSameTab(activeTab, overTab)) {
                return group;
            }

            const activeIndex = group.openTabs.findIndex((tab) => isSameTab(tab, activeTab));
            if (activeIndex < 0) {
                return group;
            }

            const nextTabs = [...group.openTabs];
            const [draggedTab] = nextTabs.splice(activeIndex, 1);
            const overIndex = overTab && position !== 'end'
                ? nextTabs.findIndex((tab) => isSameTab(tab, overTab))
                : -1;

            if (overIndex < 0) {
                nextTabs.push(draggedTab);
            } else {
                nextTabs.splice(position === 'before' ? overIndex : overIndex + 1, 0, draggedTab);
            }

            return {
                ...group,
                openTabs: nextTabs
            };
        });
    }, [updateEditorGroup]);

    const editorGroups = useMemo<LatexEditorGroup[]>(
        () => isEditorSplit
            ? [editorGroupsState[PRIMARY_EDITOR_GROUP_ID], editorGroupsState[SECONDARY_EDITOR_GROUP_ID]]
            : [editorGroupsState[PRIMARY_EDITOR_GROUP_ID]],
        [editorGroupsState, isEditorSplit]
    );

    /** Every file open in either group needs a collaboration session. */
    const openCollaborativeFileIds = useMemo(() => {
        const ids = new Set<string>();

        Object.values(editorGroupsState).forEach((group) => {
            if (group.selection?.type === 'file') {
                ids.add(group.selection.id);
            }

            group.openTabs.forEach((tab) => {
                if (tab.type === 'file') {
                    ids.add(tab.id);
                }
            });
        });

        return Array.from(ids);
    }, [editorGroupsState]);

    useEffect(() => {
        const isAvailable = (tab: LatexWorkspaceTab): boolean => tab.type === 'file'
            ? files.some((file) => file._id === tab.id)
            : assets.some((asset) => asset._id === tab.id);

        setEditorGroupsState((currentGroups) => {
            let hasChanges = false;
            const nextGroups = { ...currentGroups };

            for (const groupId of EDITOR_GROUP_IDS) {
                const currentGroup = currentGroups[groupId];
                const validTabs = currentGroup.openTabs.filter(isAvailable);
                const nextSelection = currentGroup.selection && isAvailable(currentGroup.selection)
                    ? currentGroup.selection
                    : (validTabs[validTabs.length - 1] ?? null);

                if (
                    validTabs.length !== currentGroup.openTabs.length
                    || !isSameSelection(nextSelection, currentGroup.selection)
                ) {
                    nextGroups[groupId] = {
                        ...currentGroup,
                        openTabs: validTabs,
                        selection: nextSelection
                    };
                    hasChanges = true;
                }
            }

            return hasChanges ? nextGroups : currentGroups;
        });
    }, [assets, files]);

    /** First paint of a document opens the entrypoint, else the first tex file, else anything. */
    useEffect(() => {
        const primaryGroup = editorGroupsState[PRIMARY_EDITOR_GROUP_ID];

        if (
            primaryGroup.selection
            || primaryGroup.openTabs.length > 0
            || hasBootstrappedSelectionRef.current
            || (files.length === 0 && assets.length === 0)
        ) {
            return;
        }

        hasBootstrappedSelectionRef.current = true;

        const firstFile = files.find((file) => file.isEntrypoint)
            ?? files.find((file) => isTexFile(file.name))
            ?? files[0];

        if (firstFile) {
            handleOpenTab({
                type: 'file',
                id: firstFile._id
            }, PRIMARY_EDITOR_GROUP_ID);
            return;
        }

        if (assets[0]) {
            handleOpenTab({
                type: 'asset',
                id: assets[0]._id
            }, PRIMARY_EDITOR_GROUP_ID);
        }
    }, [assets, editorGroupsState, files, handleOpenTab]);

    useEffect(() => {
        if (!isEditorSplit && activeEditorGroupId === SECONDARY_EDITOR_GROUP_ID) {
            setActiveEditorGroupId(PRIMARY_EDITOR_GROUP_ID);
        }
    }, [activeEditorGroupId, isEditorSplit]);

    return {
        activeEditorGroupId,
        isEditorSplit,
        editorGroups,
        editorGroupsState,
        openCollaborativeFileIds,
        selection: editorGroupsState[activeEditorGroupId].selection,
        handleOpenTab,
        handleSelectTab,
        handleCloseTab,
        handleFocusEditorGroup,
        handleSplitEditorDown,
        handleDuplicateTabToOtherGroup,
        handleCloseSecondaryEditorGroup,
        handleReorderTabs
    };
};

export default useLatexEditorGroups;
