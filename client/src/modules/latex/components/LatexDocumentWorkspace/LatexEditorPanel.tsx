import { cn } from '@/shared/utils/cn';
import { Callout, Box, Button, Loader, Row, Stack, EmptyState } from '@voltstack/bravais';
import { applyMonacoTheme, getMonacoThemeName } from '@/shared/ui/utils/ensure-monaco';
import { getActiveAppTheme, subscribeToAppTheme } from '@/shared/ui/utils/app-theme';
import Editor from '@monaco-editor/react';
import LatexAssetPreview from './LatexAssetPreview';
import LatexEditorTabStrip, { buildEditorPanelId, buildEditorTabId } from './LatexEditorTabStrip';
import { getFileLanguage, MONACO_OPTIONS, registerLatexLanguage } from './monaco-latex';
import { File } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import type { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import type { LatexAsset } from '@volt/contracts/modules/latex/domain';
import type {
    LatexEditorGroupId,
    LatexFileEntry,
    LatexWorkspaceSelection,
    LatexWorkspaceTab
} from '@/modules/latex/contracts/workspace';

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
    onSplitDown: (tab?: LatexWorkspaceTab) => void;
    onDuplicateTabToOtherGroup: (tab: LatexWorkspaceTab) => void;
    onCloseGroup?: () => void;
}

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

    const activeFile = activeSelection?.type === 'file'
        ? files.find((file) => file._id === activeSelection.id) ?? null
        : null;
    const activeAsset = activeSelection?.type === 'asset'
        ? assets.find((asset) => asset._id === activeSelection.id) ?? null
        : null;

    const handleMount: OnMount = (editorInstance) => {
        editorRef.current = editorInstance;
    };

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

    const renderContent = () => {
        if (activeFile) {
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
                    beforeMount={registerLatexLanguage}
                    onMount={handleMount}
                    options={MONACO_OPTIONS}
                />
            );
        }

        if (activeAsset) {
            return <LatexAssetPreview asset={activeAsset} />;
        }

        return (
            <EmptyState title='Welcome to LaTeX' description='Open a file or asset to start working.' icon={<File size={28} />} />
        );
    };

    return (
        <Stack flex='1' minH='0' className={cn(
                'latex-workspace__editor-group',
                isGroupActive && 'is-active'
            )} onMouseDownCapture={onFocusGroup}>
            <LatexEditorTabStrip
                groupId={groupId}
                isSplitView={isSplitView}
                activeSelection={activeSelection}
                openTabs={openTabs}
                files={files}
                assets={assets}
                dirtyFileIds={dirtyFileIds}
                onTabSelect={onTabSelect}
                onTabClose={onTabClose}
                onTabReorder={onTabReorder}
                onSplitDown={onSplitDown}
                onDuplicateTabToOtherGroup={onDuplicateTabToOtherGroup}
                onCloseGroup={onCloseGroup}
            />
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
            <Box ref={containerRef} id={activeSelection ? buildEditorPanelId(groupId, activeSelection) : undefined} role='tabpanel' aria-labelledby={activeSelection ? buildEditorTabId(groupId, activeSelection) : undefined} flex='1' minH='0' className='latex-workspace__editor-inner'>
                {renderContent()}
            </Box>
        </Stack>
    );
};

export default memo(LatexEditorPanel);
