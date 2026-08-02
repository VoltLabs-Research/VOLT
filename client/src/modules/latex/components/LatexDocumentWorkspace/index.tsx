import useLatexWorkspace from '@/modules/latex/hooks/use-latex-workspace';
import useLatexPanelLayout from './use-latex-panel-layout';
import useDashboardWorkspaceChrome from '@/modules/dashboard/hooks/use-dashboard-workspace-chrome';
import AccessDenied from '@/shared/ui/components/AccessDenied';
import { Box, Loader, Stack } from '@voltstack/bravais';
import '@/shared/ui/assets/stylesheets/resize-handle.css';
import { usePageTitle } from '@/shared/ui/hooks/use-page-title';
import useTip from '@/shared/tips/use-tip';
import LatexEditorPanel from './LatexEditorPanel';
import LatexFilePanel from './LatexFilePanel';
import LatexPdfViewer from './LatexPdfViewer';
import LatexWorkspaceOnboarding from './LatexWorkspaceOnboarding';
import LatexWorkspaceSkeleton from './LatexWorkspaceSkeleton';
import LatexWorkspaceToolbar from './LatexWorkspaceToolbar';
import WorkspaceResizeHandle from './WorkspaceResizeHandle';
import './LatexDocumentWorkspace.css';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { LatexEditorGroup } from '@/modules/latex/contracts/workspace';

const LatexAIPanel = lazy(() => import('./LatexAIPanel'));

const LEGACY_PLACEHOLDER_ENTRYPOINT_NAME = 'main.tex';

const LatexDocumentWorkspace = () => {
    const { documentId = '' } = useParams<{ documentId: string }>();
    const [hasEnteredWorkspace, setHasEnteredWorkspace] = useState(false);
    const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
    const initialWorkspaceVisibilityResolvedRef = useRef(false);

    const workspace = useLatexWorkspace({ documentId });
    const layout = useLatexPanelLayout({ isEditorSplit: workspace.isEditorSplit });
    const { panelWidths } = layout;
    const documentTitle = workspace.latexDocument?.title ?? 'LaTeX Document';

    const legacyPlaceholderFile = workspace.files.length === 1
        && workspace.rawAssets.length === 0
        && workspace.files[0].isEntrypoint
        && workspace.files[0].name === LEGACY_PLACEHOLDER_ENTRYPOINT_NAME
        && workspace.files[0].path === ''
        && workspace.files[0].content.trim() === ''
        ? workspace.files[0]
        : null;
    const hasWorkspaceContent = workspace.rawAssets.length > 0
        || (workspace.files.length > 0 && !legacyPlaceholderFile);
    const shouldShowWorkspaceOnboarding = !hasWorkspaceContent && !hasEnteredWorkspace;

    usePageTitle(workspace.latexDocument?.title ?? 'LaTeX Workspace');
    useDashboardWorkspaceChrome({
        collapseSidebar: true,
        hideHeader: true
    });
    useTip('latex-workspace-layout', {
        enabled: !workspace.isLoading && !workspace.accessDenied && !shouldShowWorkspaceOnboarding
    });

    useEffect(() => {
        setHasEnteredWorkspace(false);
        initialWorkspaceVisibilityResolvedRef.current = false;
    }, [documentId]);

    useEffect(() => {
        if (initialWorkspaceVisibilityResolvedRef.current || workspace.isLoading) {
            return;
        }

        setHasEnteredWorkspace(hasWorkspaceContent);
        initialWorkspaceVisibilityResolvedRef.current = true;
    }, [hasWorkspaceContent, workspace.isLoading]);

    if (workspace.isLoading) {
        return <LatexWorkspaceSkeleton panelWidths={panelWidths} isAIPanelOpen={isAIPanelOpen} />;
    }

    if (workspace.accessDenied) {
        return (
            <AccessDenied description={workspace.accessDeniedMessage} showBack={false} className='h-max w-max' />
        );
    }

    const toggleAIPanel = (): void => {
        setIsAIPanelOpen((current) => !current);
    };

    const secondaryEditorGroup = workspace.editorGroups.find((group) => group.id === 'secondary') ?? null;

    const renderEditorGroup = (group: LatexEditorGroup) => {
        const selectedFileId = group.selection?.type === 'file'
            ? group.selection.id
            : null;

        return (
            <LatexEditorPanel
                groupId={group.id}
                isGroupActive={workspace.activeEditorGroupId === group.id}
                isSplitView={workspace.isEditorSplit}
                activeSelection={group.selection}
                openTabs={group.openTabs}
                files={workspace.files}
                assets={workspace.rawAssets}
                dirtyFileIds={workspace.dirtyFileIds}
                hasPendingRemoteUpdate={Boolean(workspace.getPendingRemoteUpdateForSelection(group.selection))}
                content={workspace.getEditorContentForSelection(group.selection)}
                onFocusGroup={() => workspace.handleFocusEditorGroup(group.id)}
                onChange={(value) => workspace.handleEditorChangeForGroup(group.id, value)}
                onApplyRemoteUpdate={() => {
                    if (selectedFileId) workspace.applyPendingRemoteUpdate(selectedFileId);
                }}
                onDismissRemoteUpdate={() => {
                    if (selectedFileId) workspace.dismissPendingRemoteUpdate(selectedFileId);
                }}
                onTabSelect={(tab) => workspace.handleSelectTab(group.id, tab)}
                onTabClose={(tab) => workspace.handleCloseTab(group.id, tab)}
                onTabReorder={(activeTab, overTab, position) => workspace.handleReorderTabs(group.id, activeTab, overTab, position)}
                onSplitDown={workspace.handleSplitEditorDown}
                onDuplicateTabToOtherGroup={(tab) => workspace.handleDuplicateTabToOtherGroup(group.id, tab)}
                onCloseGroup={group.id === 'secondary' ? workspace.handleCloseSecondaryEditorGroup : undefined}
            />
        );
    };

    return (
        <Stack className='latex-workspace'>
            <LatexWorkspaceToolbar
                documentTitle={documentTitle}
                collaborators={workspace.collaborators}
                isDirty={workspace.isDirty}
                isSaving={workspace.isSaving}
                isCompiling={workspace.isCompiling}
                isExportingTex={workspace.isExportingTex}
                isExportingZip={workspace.isExportingZip}
                hasCompiledPdf={Boolean(workspace.compiledPdfUrl)}
                hasCompileError={Boolean(workspace.compileError)}
                isAIPanelOpen={isAIPanelOpen}
                onRenameDocument={workspace.handleRenameDocument}
                onToggleAIPanel={toggleAIPanel}
                onCompile={workspace.handleCompile}
                onExportTex={workspace.handleExportTex}
                onExportPdf={workspace.handleExportPdf}
                onExportZip={workspace.handleExportZip}
            />

            <Box display='flex' flex='1' minH='0' className='latex-workspace__layout'>
                {shouldShowWorkspaceOnboarding ? (
                    <LatexWorkspaceOnboarding
                        documentId={documentId}
                        legacyPlaceholderFile={legacyPlaceholderFile}
                        isUploading={workspace.isUploading}
                        fileInputRef={workspace.fileInputRef}
                        folderInputRef={workspace.folderInputRef}
                        onCreateFile={workspace.handleCreateFile}
                        onUpdateFile={workspace.updateFile}
                        onDeleteFile={workspace.deleteFile}
                        onSelectFile={workspace.handleSelectFileById}
                        onUploadFiles={workspace.handleWorkspaceFilesSelected}
                        onUploadFolders={workspace.handleWorkspaceFoldersSelected}
                        onEnteredChange={setHasEnteredWorkspace}
                    />
                ) : (
                    <>
                        <LatexFilePanel
                            documentId={documentId}
                            files={workspace.files}
                            assets={workspace.rawAssets}
                            selectedAssetId={workspace.selectedAssetId}
                            fileInputRef={workspace.fileInputRef}
                            folderInputRef={workspace.folderInputRef}
                            isUploading={workspace.isUploading}
                            onInsertRef={workspace.handleInsertAssetRef}
                            onFileSelect={workspace.handleSelectFileById}
                            onAssetSelect={workspace.handleSelectAssetById}
                            onCreateFile={workspace.handleCreateFile}
                            onCreateFolder={workspace.handleCreateFolder}
                            onDeleteFile={workspace.handleDeleteFile}
                            onDeleteAsset={workspace.handleDeleteAsset}
                            onDeleteFileDirect={workspace.deleteFile}
                            onDeleteAssetDirect={workspace.deleteAsset}
                            onUpdateFileDirect={workspace.updateFile}
                            onUpdateAssetDirect={workspace.updateAsset}
                            onRenameFile={workspace.handleRenameFile}
                            onRenameAsset={workspace.handleRenameAsset}
                            onSetEntrypoint={workspace.handleSetEntrypoint}
                            onUploadEntries={workspace.handleUploadWorkspaceEntries}
                            onUploadFiles={workspace.handleWorkspaceFilesSelected}
                            onUploadFolders={workspace.handleWorkspaceFoldersSelected}
                            width={panelWidths.files}
                        />

                        <WorkspaceResizeHandle panel='files' layout={layout} />

                        <Stack flex='1' minW='0' className='latex-workspace__main-content'>
                            <Stack ref={layout.editorStackRef} flex='1' minH='0' className='latex-workspace__editor-stack'>
                                <Stack minH='0' className='latex-workspace__editor-group-shell' style={workspace.isEditorSplit ? {
                                    height: panelWidths.editorTop,
                                    flex: '0 0 auto'
                                } : { flex: '1 1 0%' }}>
                                    {renderEditorGroup(workspace.editorGroups[0])}
                                </Stack>

                                {secondaryEditorGroup && (
                                    <>
                                        <WorkspaceResizeHandle panel='editor' layout={layout} />

                                        <Stack flex='1' minH='0' className='latex-workspace__editor-group-shell'>
                                            {renderEditorGroup(secondaryEditorGroup)}
                                        </Stack>
                                    </>
                                )}
                            </Stack>

                            {isAIPanelOpen && (
                                <>
                                    <WorkspaceResizeHandle panel='ai' layout={layout} />
                                    <Suspense fallback={
                                        <Stack id='latex-ai-panel' align='center' className='latex-ai-panel flex-center' style={{ height: panelWidths.ai }}>
                                            <Loader scale={0.5} isFixed={false} />
                                        </Stack>
                                    }>
                                        <LatexAIPanel
                                            documentId={documentId}
                                            documentTitle={documentTitle}
                                            files={workspace.files}
                                            height={panelWidths.ai}
                                            onClose={toggleAIPanel}
                                        />
                                    </Suspense>
                                </>
                            )}
                        </Stack>

                        <WorkspaceResizeHandle panel='preview' layout={layout} />

                        <Stack id='latex-preview-panel' className='latex-workspace__preview' style={{ width: panelWidths.preview }} aria-label='PDF preview panel'>
                            <Stack flex='1' minH='0' className='latex-preview__content'>
                                <LatexPdfViewer
                                    pdfUrl={workspace.compiledPdfUrl}
                                    isLoading={workspace.isCompiling}
                                    error={workspace.compileError}
                                    onDownload={workspace.compiledPdfUrl ? workspace.handleExportPdf : undefined}
                                />
                            </Stack>
                        </Stack>
                    </>
                )}
            </Box>
        </Stack>
    );
};

export default LatexDocumentWorkspace;
