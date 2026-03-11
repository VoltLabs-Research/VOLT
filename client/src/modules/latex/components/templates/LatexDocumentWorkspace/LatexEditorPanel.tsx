import Editor from '@monaco-editor/react';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import { ensureMonaco } from '@/shared/presentation/utilities/ensure-monaco';
import { useEffect, useRef, useState } from 'react';
import { FileCode } from 'lucide-react';
import type { BeforeMount, OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import type { LatexFileEntry } from '@/modules/latex/hooks/use-latex-workspace';

interface LatexEditorPanelProps {
    activeFile: LatexFileEntry | undefined;
    content: string;
    onChange: (value: string | undefined) => void;
};

const PANEL_ICON = <FileCode size={14} />;

/**
 * Registers a lightweight Monarch tokenizer for LaTeX so Monaco highlights
 * commands, comments, and math delimiters instead of falling back to plaintext.
 * The guard prevents double-registration on HMR remounts.
 */
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

/**
 * Monaco editor panel for LaTeX documents.
 * Uses a ResizeObserver on the container to call editor.layout() whenever
 * the panel is resized by the drag handles, preventing blank-area artifacts.
 */
const LatexEditorPanel = ({ activeFile, content, onChange }: LatexEditorPanelProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const [isMonacoReady, setIsMonacoReady] = useState(false);

    const handleMount: OnMount = (editorInstance) => {
        editorRef.current = editorInstance;
    };

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

    return (
        <Container className='latex-workspace__editor d-flex column'>
            <PanelHeader
                variant='compact'
                icon={PANEL_ICON}
                title={activeFile?.name ?? 'main.tex'}
            />
            <Container
                ref={containerRef}
                className='latex-workspace__editor-inner flex-1 min-h-0'
            >
                {isMonacoReady ? (
                    <Editor
                        height='100%'
                        language='latex'
                        value={content}
                        onChange={onChange}
                        theme='vs-dark'
                        beforeMount={handleBeforeMount}
                        onMount={handleMount}
                        options={{
                            fontSize: 13,
                            minimap: { enabled: false },
                            wordWrap: 'on',
                            lineNumbers: 'on',
                            scrollBeyondLastLine: false,
                            renderWhitespace: 'none',
                            padding: { top: 12 },
                            fontLigatures: false
                        }}
                    />
                ) : (
                    <Container className='h-100 d-flex align-center justify-center'>
                        <Loader scale={0.6} isFixed={false} />
                    </Container>
                )}
            </Container>
        </Container>
    );
};

export default LatexEditorPanel;
