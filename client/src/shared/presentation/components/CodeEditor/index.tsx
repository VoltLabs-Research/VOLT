import { useCallback } from 'react';
import Editor from '@monaco-editor/react';
import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import './CodeEditor.css';

export type CodeLanguage = 'json' | 'javascript' | 'typescript' | 'yaml' | 'html' | 'css' | 'markdown' | 'plaintext';

export interface CodeEditorProps {
    value: string;
    onChange: (value: string) => void;
    language?: CodeLanguage;
    height?: string | number;
    placeholder?: string;
    readOnly?: boolean;
    lineNumbers?: boolean;
    wordWrap?: boolean;
    minimap?: boolean;
    fontSize?: number;
    error?: string;
    description?: string;
    label?: string;
    className?: string;
    rows?: number;
};

const CodeEditor = ({
    value,
    onChange,
    language = 'json',
    height,
    readOnly = false,
    lineNumbers = true,
    wordWrap = true,
    minimap = false,
    fontSize = 13,
    error,
    description,
    label,
    className = '',
    rows
}: CodeEditorProps) => {
    const handleEditorMount = useCallback((_editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
        if (language === 'json') {
            monaco.languages.json.jsonDefaults.setModeConfiguration({
                documentFormattingEdits: false,
                documentRangeFormattingEdits: false,
                completionItems: false,
                hovers: true,
                documentSymbols: false,
                tokens: true,
                colors: false,
                foldingRanges: true,
                diagnostics: true,
                selectionRanges: false
            });
        }
    }, [language]);

    const handleChange = useCallback((newValue: string | undefined) => {
        onChange(newValue ?? '');
    }, [onChange]);

    // Convert rows to height
    const editorHeight = height 
        ? (typeof height === 'number' ? `${height}px` : height)
        : rows 
            ? `${rows * 20}px`
            : '200px';

    return (
        <Container className={`code-editor-wrapper d-flex column gap-05 ${className} ${error ? 'has-error' : ''}`}>
            {label && <label className='code-editor-label font-size-1 font-weight-5 color-primary'>{label}</label>}
            {description && <Paragraph className='code-editor-description color-secondary'>{description}</Paragraph>}

            <Container className='p-relative overflow-hidden code-editor-container' style={{ height: editorHeight }}>
                <Editor
                    value={value}
                    language={language}
                    theme='vs-dark'
                    onChange={handleChange}
                    onMount={handleEditorMount}
                    options={{
                        readOnly,
                        lineNumbers: lineNumbers ? 'on' : 'off',
                        wordWrap: wordWrap ? 'on' : 'off',
                        minimap: { enabled: minimap },
                        fontSize,
                        fontFamily: '\'JetBrains Mono\', \'Fira Code\', \'Monaco\', \'Menlo\', \'Ubuntu Mono\', monospace',
                        fontLigatures: true,
                        tabSize: 2,
                        insertSpaces: true,
                        autoClosingBrackets: 'languageDefined',
                        autoClosingQuotes: 'languageDefined',
                        autoIndent: 'keep',
                        formatOnPaste: false,
                        formatOnType: false,
                        automaticLayout: true,
                        scrollBeyondLastLine: false,
                        padding: { top: 12, bottom: 12 },
                        folding: true,
                        foldingHighlight: true,
                        bracketPairColorization: { enabled: true },
                        matchBrackets: 'always',
                        renderLineHighlight: 'line',
                        cursorBlinking: 'smooth',
                        cursorSmoothCaretAnimation: 'on',
                        smoothScrolling: true,
                        scrollbar: {
                            vertical: 'auto',
                            horizontal: 'auto',
                            verticalScrollbarSize: 8,
                            horizontalScrollbarSize: 8
                        },
                        overviewRulerLanes: 0,
                        hideCursorInOverviewRuler: true,
                        overviewRulerBorder: false,
                        glyphMargin: false,
                        lineDecorationsWidth: 8,
                        lineNumbersMinChars: 3,
                        suggestOnTriggerCharacters: false,
                        acceptSuggestionOnEnter: 'on',
                        acceptSuggestionOnCommitCharacter: false,
                        tabCompletion: 'on',
                        wordBasedSuggestions: 'off',
                        quickSuggestions: false
                    }}
                />
            </Container>

            {error && <Paragraph className='code-editor-error'>{error}</Paragraph>}
        </Container>
    );
};

export default CodeEditor;
