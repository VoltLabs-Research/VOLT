import Editor from '@monaco-editor/react';
import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Button from '@/shared/presentation/components/Button';
import { ensureMonaco } from '@/shared/presentation/utilities/ensure-monaco';
import { cn } from '@/shared/utils';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Download, File, FileCode, FileImage, FileText, X } from 'lucide-react';
import type { BeforeMount, OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import type { LatexAsset } from '@/modules/latex/api/entities/latex-asset';
import type { LatexFileEntry, LatexWorkspaceSelection, LatexWorkspaceTab } from '@/modules/latex/hooks/use-latex-workspace';
import { getAssetDisplayName, isWorkspaceImageFile, isWorkspacePdfFile, isWorkspaceTextLikeFile } from '@/modules/latex/utilities/workspace';
import LatexPdfViewer from './LatexPdfViewer';

interface LatexEditorPanelProps {
    activeSelection: LatexWorkspaceSelection;
    openTabs: LatexWorkspaceTab[];
    files: LatexFileEntry[];
    assets: LatexAsset[];
    dirtyFileIds: string[];
    content: string;
    onChange: (value: string | undefined) => void;
    onTabSelect: (tab: LatexWorkspaceTab) => void;
    onTabClose: (tab: LatexWorkspaceTab) => void;
}

type AssetKind = 'pdf' | 'image' | 'text' | 'binary';

interface EditorTabItem {
    key: string;
    title: string;
    icon: ReactNode;
    selection: LatexWorkspaceTab;
    isActive: boolean;
    isDirty: boolean;
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

const PANEL_ICON = <FileCode size={14} />;

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

    const pathname = asset.path ?? asset.originalName;
    if (isWorkspacePdfFile(pathname, asset.mimetype)) return 'pdf';
    if (isWorkspaceImageFile(pathname, asset.mimetype)) return 'image';
    if (isWorkspaceTextLikeFile(pathname, asset.mimetype)) return 'text';
    return 'binary';
};

const getSelectionKey = (selection: LatexWorkspaceTab): string => `${selection.type}:${selection.id}`;

const LatexEditorPanel = ({
    activeSelection,
    openTabs,
    files,
    assets,
    dirtyFileIds,
    content,
    onChange,
    onTabSelect,
    onTabClose
}: LatexEditorPanelProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const [isMonacoReady, setIsMonacoReady] = useState(false);

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
        const icon = assetKind === 'image'
            ? <FileImage size={14} />
            : assetKind === 'pdf'
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

    const handleMount: OnMount = useCallback((editorInstance) => {
        editorRef.current = editorInstance;
    }, []);

    useEffect(() => {
        let isMounted = true;

        void ensureMonaco().then(() => {
            if (isMounted) {
                setIsMonacoReady(true);
            }
        });

        return () => {
            isMounted = false;
        };
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
        <Container className='h-100 d-flex column justify-center items-center gap-1'>
            <File size={28} className='color-muted' />
            <Paragraph className='color-muted'>Open a file or asset to start working.</Paragraph>
        </Container>
    );

    const renderBinaryAsset = () => {
        if (!activeAsset) return renderEmpty();

        return (
            <Container className='h-100 d-flex column flex-center items-center gap-1 p-2 text-center'>
                <FileText size={28} className='color-muted' />
                <Paragraph className='color-muted'>
                    This file can&apos;t be previewed inline.
                </Paragraph>
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
            </Container>
        );
    };

    const renderAsset = () => {
        if (!activeAsset) return renderEmpty();

        if (activeAssetKind === 'pdf') {
            return (
                <LatexPdfViewer
                    pdfUrl={activeAsset.url}
                    onDownload={() => window.open(activeAsset.url, '_blank', 'noopener,noreferrer')}
                    downloadLabel='Open PDF'
                />
            );
        }

        if (activeAssetKind === 'image') {
            return (
                <Container className='h-100 d-flex flex-center items-center p-1 overflow-auto'>
                    <img
                        src={activeAsset.url}
                        alt={headerTitle}
                        className='mw-max mh-max object-contain'
                    />
                </Container>
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
                <Container className='h-100 d-flex align-center justify-center'>
                    <Loader scale={0.6} isFixed={false} />
                </Container>
            );
        }

        return (
            <Editor
                height='100%'
                language={getFileLanguage(activeFile.name)}
                value={content}
                onChange={onChange}
                theme='vs-dark'
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

    return (
        <Container className='latex-workspace__editor d-flex column'>
            <Container
                ref={containerRef}
                className='latex-workspace__editor-inner flex-1 min-h-0'
            >
                {renderContent()}
            </Container>
        </Container>
    );
};

export default memo(LatexEditorPanel);
