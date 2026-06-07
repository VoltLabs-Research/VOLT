import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import { Callout, Box, Button, IconButton, Loader, Row, Stack, Text, EmptyState } from '@voltstack/bravais';
import { applyMonacoTheme, getMonacoThemeName } from '@/shared/presentation/utilities/ensure-monaco';
import { getActiveAppTheme, subscribeToAppTheme } from '@/shared/presentation/utilities/app-theme';
import Editor from '@monaco-editor/react';
import type { BeforeMount, OnMount } from '@monaco-editor/react';
import { Download, File, FileCode, FileImage, FileText, PanelBottom, X } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { editor } from 'monaco-editor';
import type { DragEvent, ReactNode } from 'react';
import type { LatexAsset } from '@/modules/latex/api/entities/latex-asset';
import type { LatexEditorGroupId, LatexFileEntry, LatexWorkspaceSelection, LatexWorkspaceTab } from '@/modules/latex/hooks/use-latex-workspace';
import { getAssetDisplayName, isWorkspaceImageFile, isWorkspacePdfFile, isWorkspaceTextLikeFile } from '@/modules/latex/utilities/workspace';
import LatexPdfViewer from './LatexPdfViewer';
import type { MenuOption } from '@/shared/presentation/types/menu';
interface LatexEditorPanelProps {
    groupId: LatexEditorGroupId;
    isGroupActive: boolean;
    isSplitView: boolean;
    activeSelection: LatexWorkspaceSelection;
    openTabs: LatexWorkspaceTab[];
    files: LatexFileEntry[];
    assets: LatexAsset[];
    dirtyFileIds: string[];
    hasPendingRemoteUpdate: boolean;
    content: string;
    onFocusGroup: () => void;
    onChange: (value: string | undefined) => void;
    onApplyRemoteUpdate: () => void;
    onDismissRemoteUpdate: () => void;
    onTabSelect: (tab: LatexWorkspaceTab) => void;
    onTabClose: (tab: LatexWorkspaceTab) => void;
    onTabReorder: (activeTab: LatexWorkspaceTab, overTab: LatexWorkspaceTab | null, position: 'before' | 'after' | 'end') => void;
    onSplitDown?: (tab?: LatexWorkspaceTab) => void;
    onDuplicateTabToOtherGroup?: (tab: LatexWorkspaceTab) => void;
    onCloseGroup?: () => void;
}

enum AssetKind {
    Pdf = 'pdf',
    Image = 'image',
    Text = 'text',
    Binary = 'binary'
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

const getFileLanguage = (filename: string): string => {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.tex') || lower.endsWith('.bib') || lower.endsWith('.cls') || lower.endsWith('.sty')) return 'latex';
    if (lower.endsWith('.json')) return 'json';
    if (lower.endsWith('.js')) return 'javascript';
    if (lower.endsWith('.ts')) return 'typescript';
    if (lower.endsWith('.css')) return 'css';
    if (lower.endsWith('.html')) return 'html';
    if (lower.endsWith('.xml') || lower.endsWith('.svg')) return 'xml';
    if (lower.endsWith('.md')) return 'markdown';
    if (lower.endsWith('.py')) return 'python';
    if (lower.endsWith('.sh')) return 'shell';
    return 'plaintext';
};

const MONACO_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
    fontSize: 13,
    minimap: { enabled: false },
    wordWrap: 'on',
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    renderWhitespace: 'none',
    padding: { top: 12 },
    fontLigatures: false
};

const handleBeforeMount: BeforeMount = (monaco) => {
    const alreadyRegistered = monaco.languages.getLanguages().some((l) => l.id === 'latex');
    if (alreadyRegistered) return;

    monaco.languages.register({ id: 'latex' });
    monaco.languages.setMonarchTokensProvider('latex', {
        tokenizer: {
            root: [
                [/%.*$/, 'comment'],
                [/\$\$[\s\S]*?\$\$/, 'string'],
                [/\$[^$]*\$/, 'string'],
                [/\\[a-zA-Z]+/, 'keyword'],
                [/[{}[\]]/, 'delimiter.bracket']
            ]
        }
    });
};

const getAssetKind = (asset: LatexAsset | null): AssetKind | null => {
    if (!asset) return null;

    const pathname = asset.path;
    if (isWorkspacePdfFile(pathname, asset.mimetype)) return AssetKind.Pdf;
    if (isWorkspaceImageFile(pathname, asset.mimetype)) return AssetKind.Image;
    if (isWorkspaceTextLikeFile(pathname, asset.mimetype)) return AssetKind.Text;
    return AssetKind.Binary;
};

const getSelectionKey = (selection: LatexWorkspaceTab): string => `${selection.type}:${selection.id}`;

const LatexEditorPanel = ({
    groupId,
    isGroupActive,
    isSplitView,
    activeSelection,
    openTabs,
    files,
    assets,
    dirtyFileIds,
    hasPendingRemoteUpdate,
    content,
    onFocusGroup,
    onChange,
    onApplyRemoteUpdate,
    onDismissRemoteUpdate,
    onTabSelect,
    onTabClose,
    onTabReorder,
    onSplitDown,
    onDuplicateTabToOtherGroup,
    onCloseGroup
}: LatexEditorPanelProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const [isMonacoReady, setIsMonacoReady] = useState(false);
    const [monacoTheme, setMonacoTheme] = useState(() => getMonacoThemeName(getActiveAppTheme()));
    const [draggedTabKey, setDraggedTabKey] = useState<string | null>(null);
    const [dropIndicator, setDropIndicator] = useState<TabDropIndicator | null>(null);

    const activeFile = useMemo(
        () => activeSelection?.type === 'file'
            ? files.find((file) => file._id === activeSelection.id) ?? null
            : null,
        [activeSelection, files]
    );

    const activeAsset = useMemo(
        () => activeSelection?.type === 'asset'
            ? assets.find((asset) => asset._id === activeSelection.id) ?? null
            : null,
        [activeSelection, assets]
    );

    const headerTitle = activeFile?.name ?? (activeAsset ? getAssetDisplayName(activeAsset) : 'No file selected');
    const activeAssetKind = useMemo(() => getAssetKind(activeAsset), [activeAsset]);
    const dirtyFileIdSet = useMemo(() => new Set(dirtyFileIds), [dirtyFileIds]);

    const tabItems = useMemo<EditorTabItem[]>(() => openTabs.reduce<EditorTabItem[]>((items, tab) => {
        if (tab.type === 'file') {
            const file = files.find((currentFile) => currentFile._id === tab.id);
            if (!file) {
                return items;
            }

            items.push({
                key: getSelectionKey(tab),
                title: file.name,
                icon: <FileCode size={14} />,
                selection: tab,
                isActive: activeSelection?.type === 'file' && activeSelection.id === file._id,
                isDirty: dirtyFileIdSet.has(file._id)
            });
            return items;
        }

        const asset = assets.find((currentAsset) => currentAsset._id === tab.id);
        if (!asset) {
            return items;
        }

        const assetKind = getAssetKind(asset);
        const icon = assetKind === AssetKind.Image
            ? <FileImage size={14} />
            : assetKind === AssetKind.Pdf
                ? <FileText size={14} />
                : <File size={14} />;

        items.push({
            key: getSelectionKey(tab),
            title: getAssetDisplayName(asset),
            icon,
            selection: tab,
            isActive: activeSelection?.type === 'asset' && activeSelection.id === asset._id,
            isDirty: false
        });
        return items;
    }, []), [activeSelection, assets, dirtyFileIdSet, files, openTabs]);

    const activeTabItem = useMemo(
        () => tabItems.find((tab) => tab.isActive) ?? null,
        [tabItems]
    );

    const clearTabDragState = useCallback((): void => {
        setDraggedTabKey(null);
        setDropIndicator(null);
    }, []);

    const handleTabDragStart = useCallback((event: DragEvent<HTMLDivElement>, tab: EditorTabItem): void => {
        if ((event.target as HTMLElement | null)?.closest('.latex-editor-tab__close')) {
            event.preventDefault();
            return;
        }

        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', tab.key);
        setDraggedTabKey(tab.key);
        setDropIndicator(null);
    }, []);

    const handleTabDragOver = useCallback((event: DragEvent<HTMLDivElement>, tab: EditorTabItem): void => {
        if (!draggedTabKey || draggedTabKey === tab.key) {
            return;
        }

        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const position = event.clientX <= rect.left + rect.width / 2
            ? 'before'
            : 'after';

        setDropIndicator({
            targetKey: tab.key,
            position
        });
    }, [draggedTabKey]);

    const handleTabStripDragOver = useCallback((event: DragEvent<HTMLDivElement>): void => {
        if (!draggedTabKey) {
            return;
        }

        event.preventDefault();
        const target = event.target as HTMLElement | null;
        if (target?.closest('.latex-editor-tab')) {
            return;
        }

        setDropIndicator({ targetKey: null, position: 'end' });
    }, [draggedTabKey]);

    const commitTabReorder = useCallback((targetKey: string | null, position: 'before' | 'after' | 'end'): void => {
        if (!draggedTabKey) {
            return;
        }

        const draggedTab = tabItems.find((tab) => tab.key === draggedTabKey);
        const targetTab = targetKey
            ? tabItems.find((tab) => tab.key === targetKey) ?? null
            : null;

        if (draggedTab) {
            onTabReorder(draggedTab.selection, targetTab?.selection ?? null, position);
        }

        clearTabDragState();
    }, [clearTabDragState, draggedTabKey, onTabReorder, tabItems]);

    const handleTabDrop = useCallback((event: DragEvent<HTMLDivElement>, tab: EditorTabItem): void => {
        event.preventDefault();
        const nextPosition = dropIndicator?.targetKey === tab.key
            ? dropIndicator.position
            : 'after';
        commitTabReorder(tab.key, nextPosition === 'end' ? 'after' : nextPosition);
    }, [commitTabReorder, dropIndicator]);

    const handleTabStripDrop = useCallback((event: DragEvent<HTMLDivElement>): void => {
        event.preventDefault();
        commitTabReorder(null, 'end');
    }, [commitTabReorder]);

    const getTabMenuOptions = useCallback((tab: EditorTabItem): MenuOption[] => {
        const nextOptions: MenuOption[] = [];

        if (!isSplitView && onSplitDown) {
            nextOptions.push({
                label: 'Split Down',
                icon: PanelBottom,
                onClick: () => onSplitDown(tab.selection)
            });
        } else if (onDuplicateTabToOtherGroup) {
            nextOptions.push({
                label: groupId === 'primary' ? 'Open Below' : 'Open Above',
                icon: PanelBottom,
                onClick: () => onDuplicateTabToOtherGroup(tab.selection)
            });
        }

        nextOptions.push({
            label: 'Close',
            icon: X,
            onClick: () => onTabClose(tab.selection)
        });

        return nextOptions;
    }, [groupId, isSplitView, onDuplicateTabToOtherGroup, onSplitDown, onTabClose]);

    const handleMount: OnMount = useCallback((editorInstance) => {
        editorRef.current = editorInstance;
    }, []);

    useEffect(() => {
        let isMounted = true;

        applyMonacoTheme().then(() => {
            if (isMounted) {
                setIsMonacoReady(true);
            }
        });

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        return subscribeToAppTheme((theme) => {
            setMonacoTheme(getMonacoThemeName(theme));
            applyMonacoTheme(theme);
        });
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !isMonacoReady) return;

        const observer = new ResizeObserver(() => {
            editorRef.current?.layout();
        });

        observer.observe(container);
        return () => observer.disconnect();
    }, [isMonacoReady]);

    const renderEmpty = () => (
        <EmptyState title='Welcome to LaTeX' description='Open a file or asset to start working.' icon={<File size={28} />} />
    );

    const renderBinaryAsset = () => {
        if (!activeAsset) return renderEmpty();

        return (
            <Stack align='center' gap='1' p='2' textAlign='center' className='h-100 flex-center'>
                <FileText size={28} className='color-muted' />
                <Text as='p' tone='muted'>
                    This file can&apos;t be previewed inline.
                </Text>
                <Button
                    variant='ghost'
                    intent='brand'
                    size='sm'
                    shape='rounded'
                    onClick={() => window.open(activeAsset.url, '_blank', 'noopener,noreferrer')}
                >
                    <Download size={14} />
                    Open file
                </Button>
            </Stack>
        );
    };

    const renderAsset = () => {
        if (!activeAsset) return renderEmpty();

        if (activeAssetKind === AssetKind.Pdf) {
            return (
                <LatexPdfViewer
                    pdfUrl={activeAsset.url}
                    onDownload={() => window.open(activeAsset.url, '_blank', 'noopener,noreferrer')}
                    downloadLabel='Open PDF'
                />
            );
        }

        if (activeAssetKind === AssetKind.Image) {
            return (
                <Row height='max' p='1' overflow='auto' className='flex-center'>
                    <img
                        src={activeAsset.url}
                        alt={headerTitle}
                        className='mw-max mh-max object-contain'
                    />
                </Row>
            );
        }

        return renderBinaryAsset();
    };

    const renderFileEditor = () => {
        if (!activeFile) {
            return renderEmpty();
        }

        if (!isMonacoReady) {
            return (
                <Box display='flex' className='h-100 align-center justify-center'>
                    <Loader scale={0.6} isFixed={false} />
                </Box>
            );
        }

        return (
            <Editor
                height='100%'
                language={getFileLanguage(activeFile.name)}
                value={content}
                onChange={onChange}
                theme={monacoTheme}
                beforeMount={handleBeforeMount}
                onMount={handleMount}
                options={MONACO_OPTIONS}
            />
        );
    };

    const renderContent = () => {
        if (activeFile) {
            return renderFileEditor();
        }

        if (activeAsset) {
            return renderAsset();
        }

        return renderEmpty();
    };

    const headerActions = (
        <Row gap='025'>
            {!isSplitView && activeTabItem && onSplitDown && (
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
            {isSplitView && onCloseGroup && groupId === 'secondary' && (
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
    );

    const shouldShowTabsHeader = tabItems.length > 0
        || (!isSplitView && Boolean(activeTabItem))
        || Boolean(isSplitView && onCloseGroup && groupId === 'secondary');

    const renderTab = (tab: EditorTabItem) => {
        const tabId = `latex-editor-tab-${groupId}-${tab.key}`;
        const panelId = `latex-editor-panel-${groupId}-${tab.key}`;
        const tabMenuOptions = getTabMenuOptions(tab);
        const isDropBefore = dropIndicator?.targetKey === tab.key && dropIndicator.position === 'before';
        const isDropAfter = dropIndicator?.targetKey === tab.key && dropIndicator.position === 'after';

        return (
            <ContextMenuPopover
                key={tab.key}
                id={`latex-editor-tab-context-${groupId}-${tab.key}`}
                options={tabMenuOptions}
                size='sm'
                trigger={(
                    <div className={[
                            'latex-editor-tab d-flex items-center',
                            tab.isActive ? 'is-active' : '',
                            draggedTabKey === tab.key ? 'is-dragging' : '',
                            isDropBefore ? 'is-drop-before' : '',
                            isDropAfter ? 'is-drop-after' : ''
                        ].filter(Boolean).join(' ')} draggable onDragStart={(event) => handleTabDragStart(event, tab)} onDragOver={(event) => handleTabDragOver(event, tab)} onDrop={(event) => handleTabDrop(event, tab)} onDragEnd={clearTabDragState}>
                        <button
                            type='button'
                            id={tabId}
                            role='tab'
                            aria-selected={tab.isActive}
                            aria-controls={panelId}
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
    };

    return (
        <Stack flex='1' minH='0' className={[
                'latex-workspace__editor-group',
                isGroupActive ? 'is-active' : ''
            ].filter(Boolean).join(' ')} onMouseDownCapture={() => onFocusGroup()}>
            {shouldShowTabsHeader && (
                <Row justify='between' gap='05' p='05' className='latex-editor-tabs__header'>
                    <Row gap='05' overflow='auto' flex='1' className={[
                            'latex-editor-tabs',
                            dropIndicator?.targetKey === null && dropIndicator?.position === 'end' ? 'is-drop-at-end' : ''
                        ].filter(Boolean).join(' ')} role='tablist' aria-label={groupId === 'primary' ? 'Open LaTeX files in the top editor group' : 'Open LaTeX files in the bottom editor group'} onDragOver={handleTabStripDragOver} onDrop={handleTabStripDrop} onDragEnd={clearTabDragState}>
                        {tabItems.map(renderTab)}
                    </Row>
                    {headerActions}
                </Row>
            )}
            {activeFile && hasPendingRemoteUpdate && (
                <Row justify='between' gap='1' p='075'>
                    <Callout
                        tone='warning'
                        message={`A collaborator updated ${activeFile.name}. Apply the remote version or keep editing your local draft.`}
                    />
                    <Row gap='05'>
                        <Button variant='ghost' intent='neutral' size='sm' onClick={onDismissRemoteUpdate}>
                            Keep mine
                        </Button>
                        <Button variant='solid' intent='brand' size='sm' onClick={onApplyRemoteUpdate}>
                            Apply remote
                        </Button>
                    </Row>
                </Row>
            )}
            <Box ref={containerRef} id={activeSelection ? `latex-editor-panel-${groupId}-${getSelectionKey(activeSelection)}` : undefined} role='tabpanel' aria-labelledby={activeSelection ? `latex-editor-tab-${groupId}-${getSelectionKey(activeSelection)}` : undefined} flex='1' minH='0' className='latex-workspace__editor-inner'>
                {renderContent()}
            </Box>
        </Stack>
    );
};

export default memo(LatexEditorPanel);
