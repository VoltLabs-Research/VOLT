import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import { cn } from '@/shared/utils/cn';
import { getAssetDisplayName, isWorkspaceImageFile, isWorkspacePdfFile } from '@/modules/latex/utils/workspace';
import { IconButton, Row } from '@voltstack/bravais';
import { File, FileCode, FileImage, FileText, PanelBottom, X } from 'lucide-react';
import { useState } from 'react';
import type { LatexAsset } from '@volt/contracts/modules/latex/domain';
import type {
    LatexEditorGroupId,
    LatexFileEntry,
    LatexWorkspaceSelection,
    LatexWorkspaceTab
} from '@/modules/latex/contracts/workspace';
import type { MenuOption } from '@/shared/contracts/menu';
import type { DragEvent, ReactNode } from 'react';

interface LatexEditorTabStripProps {
    groupId: LatexEditorGroupId;
    isSplitView: boolean;
    activeSelection: LatexWorkspaceSelection;
    openTabs: LatexWorkspaceTab[];
    files: LatexFileEntry[];
    assets: LatexAsset[];
    dirtyFileIds: string[];
    onTabSelect: (tab: LatexWorkspaceTab) => void;
    onTabClose: (tab: LatexWorkspaceTab) => void;
    onTabReorder: (activeTab: LatexWorkspaceTab, overTab: LatexWorkspaceTab | null, position: 'before' | 'after' | 'end') => void;
    onSplitDown: (tab?: LatexWorkspaceTab) => void;
    onDuplicateTabToOtherGroup: (tab: LatexWorkspaceTab) => void;
    onCloseGroup?: () => void;
}

interface EditorTabItem {
    key: string;
    title: string;
    icon: ReactNode;
    selection: LatexWorkspaceTab;
    isActive: boolean;
    isDirty: boolean;
}

interface TabDropIndicator {
    targetKey: string | null;
    position: 'before' | 'after' | 'end';
}

const getSelectionKey = (selection: LatexWorkspaceTab): string => `${selection.type}:${selection.id}`;

export const buildEditorTabId = (groupId: LatexEditorGroupId, selection: LatexWorkspaceTab): string => {
    return `latex-editor-tab-${groupId}-${getSelectionKey(selection)}`;
};

export const buildEditorPanelId = (groupId: LatexEditorGroupId, selection: LatexWorkspaceTab): string => {
    return `latex-editor-panel-${groupId}-${getSelectionKey(selection)}`;
};

const getAssetTabIcon = (asset: LatexAsset): ReactNode => {
    if (isWorkspaceImageFile(asset.path, asset.mimetype)) {
        return <FileImage size={14} />;
    }

    if (isWorkspacePdfFile(asset.path, asset.mimetype)) {
        return <FileText size={14} />;
    }

    return <File size={14} />;
};

/** Reorderable tab bar of one editor group, plus its split/close controls. */
const LatexEditorTabStrip = ({
    groupId,
    isSplitView,
    activeSelection,
    openTabs,
    files,
    assets,
    dirtyFileIds,
    onTabSelect,
    onTabClose,
    onTabReorder,
    onSplitDown,
    onDuplicateTabToOtherGroup,
    onCloseGroup
}: LatexEditorTabStripProps) => {
    const [draggedTabKey, setDraggedTabKey] = useState<string | null>(null);
    const [dropIndicator, setDropIndicator] = useState<TabDropIndicator | null>(null);
    const dirtyFileIdSet = new Set(dirtyFileIds);

    const tabItems = openTabs.reduce<EditorTabItem[]>((items, tab) => {
        const isActive = activeSelection?.type === tab.type && activeSelection.id === tab.id;

        if (tab.type === 'file') {
            const file = files.find((currentFile) => currentFile._id === tab.id);

            if (file) {
                items.push({
                    key: getSelectionKey(tab),
                    title: file.name,
                    icon: <FileCode size={14} />,
                    selection: tab,
                    isActive,
                    isDirty: dirtyFileIdSet.has(file._id)
                });
            }

            return items;
        }

        const asset = assets.find((currentAsset) => currentAsset._id === tab.id);

        if (asset) {
            items.push({
                key: getSelectionKey(tab),
                title: getAssetDisplayName(asset),
                icon: getAssetTabIcon(asset),
                selection: tab,
                isActive,
                isDirty: false
            });
        }

        return items;
    }, []);

    if (tabItems.length === 0 && !(isSplitView && onCloseGroup)) {
        return null;
    }

    const activeTabItem = tabItems.find((tab) => tab.isActive) ?? null;

    const clearTabDragState = (): void => {
        setDraggedTabKey(null);
        setDropIndicator(null);
    };

    const commitTabReorder = (targetKey: string | null, position: TabDropIndicator['position']): void => {
        const draggedTab = tabItems.find((tab) => tab.key === draggedTabKey);
        const targetTab = tabItems.find((tab) => tab.key === targetKey) ?? null;

        if (draggedTab) {
            onTabReorder(draggedTab.selection, targetTab?.selection ?? null, position);
        }

        clearTabDragState();
    };

    const handleTabDragStart = (event: DragEvent<HTMLDivElement>, tab: EditorTabItem): void => {
        if ((event.target as HTMLElement | null)?.closest('.latex-editor-tab__close')) {
            event.preventDefault();
            return;
        }

        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', tab.key);
        setDraggedTabKey(tab.key);
        setDropIndicator(null);
    };

    const handleTabDragOver = (event: DragEvent<HTMLDivElement>, tab: EditorTabItem): void => {
        if (!draggedTabKey || draggedTabKey === tab.key) {
            return;
        }

        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();

        setDropIndicator({
            targetKey: tab.key,
            position: event.clientX <= rect.left + rect.width / 2 ? 'before' : 'after'
        });
    };

    const handleTabStripDragOver = (event: DragEvent<HTMLDivElement>): void => {
        if (!draggedTabKey || (event.target as HTMLElement | null)?.closest('.latex-editor-tab')) {
            return;
        }

        event.preventDefault();
        setDropIndicator({
            targetKey: null,
            position: 'end'
        });
    };

    const getTabMenuOptions = (tab: EditorTabItem): MenuOption[] => [
        isSplitView
            ? {
                label: groupId === 'primary' ? 'Open Below' : 'Open Above',
                icon: PanelBottom,
                onClick: () => onDuplicateTabToOtherGroup(tab.selection)
            }
            : {
                label: 'Split Down',
                icon: PanelBottom,
                onClick: () => onSplitDown(tab.selection)
            },
        {
            label: 'Close',
            icon: X,
            onClick: () => onTabClose(tab.selection)
        }
    ];

    const renderTab = (tab: EditorTabItem) => (
        <ContextMenuPopover
            key={tab.key}
            id={`latex-editor-tab-context-${groupId}-${tab.key}`}
            options={getTabMenuOptions(tab)}
            size='sm'
            trigger={(
                <div className={cn(
                        'latex-editor-tab d-flex items-center',
                        tab.isActive && 'is-active',
                        draggedTabKey === tab.key && 'is-dragging',
                        dropIndicator?.targetKey === tab.key && dropIndicator.position === 'before' && 'is-drop-before',
                        dropIndicator?.targetKey === tab.key && dropIndicator.position === 'after' && 'is-drop-after'
                    )} draggable onDragStart={(event) => handleTabDragStart(event, tab)} onDragOver={(event) => handleTabDragOver(event, tab)} onDrop={(event) => {
                        event.preventDefault();
                        const nextPosition = dropIndicator?.targetKey === tab.key
                            ? dropIndicator.position
                            : 'after';
                        commitTabReorder(tab.key, nextPosition === 'end' ? 'after' : nextPosition);
                    }} onDragEnd={clearTabDragState}>
                    <button
                        type='button'
                        id={buildEditorTabId(groupId, tab.selection)}
                        role='tab'
                        aria-selected={tab.isActive}
                        aria-controls={buildEditorPanelId(groupId, tab.selection)}
                        className='latex-editor-tab__button d-flex items-center gap-05 flex-1 min-w-0'
                        onClick={() => onTabSelect(tab.selection)}
                    >
                        <Row as='span' justify='center' className='latex-editor-tab__icon'>
                            {tab.icon}
                        </Row>
                        <span className='latex-editor-tab__label'>
                            {tab.title}
                        </span>
                        {tab.isDirty && <span className='latex-editor-tab__dirty-dot' />}
                    </button>

                    <button
                        type='button'
                        draggable={false}
                        className='latex-editor-tab__close d-flex items-center content-center'
                        aria-label={`Close ${tab.title}`}
                        onClick={() => onTabClose(tab.selection)}
                    >
                        <X size={13} />
                    </button>
                </div>
            )}
        />
    );

    return (
        <Row justify='between' gap='05' p='05' className='latex-editor-tabs__header'>
            <Row gap='05' overflow='auto' flex='1' className={cn(
                    'latex-editor-tabs',
                    dropIndicator?.position === 'end' && 'is-drop-at-end'
                )} role='tablist' aria-label={groupId === 'primary' ? 'Open LaTeX files in the top editor group' : 'Open LaTeX files in the bottom editor group'} onDragOver={handleTabStripDragOver} onDrop={(event) => {
                    event.preventDefault();
                    commitTabReorder(null, 'end');
                }} onDragEnd={clearTabDragState}>
                {tabItems.map(renderTab)}
            </Row>
            <Row gap='025'>
                {!isSplitView && activeTabItem && (
                    <IconButton
                        variant='ghost'
                        size='sm'
                        className='latex-editor-tabs__action'
                        title='Split editor down'
                        aria-label='Split editor down'
                        onClick={() => onSplitDown(activeTabItem.selection)}
                    >
                        <PanelBottom size={14} />
                    </IconButton>
                )}
                {isSplitView && onCloseGroup && (
                    <IconButton
                        variant='ghost'
                        size='sm'
                        className='latex-editor-tabs__action'
                        title='Close lower editor group'
                        aria-label='Close lower editor group'
                        onClick={onCloseGroup}
                    >
                        <X size={14} />
                    </IconButton>
                )}
            </Row>
        </Row>
    );
};

export default LatexEditorTabStrip;
