import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Editor from '@monaco-editor/react';

import EditorWidget from '../EditorWidget';
import type { EditorWidgetRef } from '../EditorWidget';
import './MonacoEditor.css';

interface ExecutionResponse {
    exit_code: number;
    stdout: string;
    stderr: string;
    result: any;
    execution_time?: number;
}

interface MonacoEditorProps {
    defaultVisible?: boolean;
    onToggle?: (visible: boolean) => void;
}

interface TerminalLine {
    id: number;
    text: string;
    type: 'stdout' | 'stderr' | 'info' | 'success' | 'error';
}

const MonacoEditor: React.FC<MonacoEditorProps> = ({ 
    defaultVisible = false,
    onToggle 
}) => {
    const [isVisible, setIsVisible] = useState(defaultVisible);
    const [code, setCode] = useState<string>(
        '# Write your code here\nimport sys\nimport time\n\nprint("Hello from stdout!")\nprint("This is an error", file=sys.stderr)'
    );
    const [output, setOutput] = useState<ExecutionResponse | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [outputHeight, setOutputHeight] = useState<number>(250);
    const [language, setLanguage] = useState<string>('python');
    const [theme, setTheme] = useState<'vs-dark' | 'light'>('vs-dark');
    const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);

    const editorWidgetRef = useRef<EditorWidgetRef>(null);
    const outputPaneRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<any>(null);
    const terminalEndRef = useRef<HTMLDivElement>(null);
    const lineIdCounter = useRef<number>(0);

    const addTerminalLine = useCallback((text: string, type: TerminalLine['type'] = 'info') => {
        const newLine: TerminalLine = {
            id: lineIdCounter.current++,
            text,
            type
        };
        
        setTerminalLines(prev => [...prev, newLine]);
        
        setTimeout(() => {
            terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }, []);

    const clearTerminal = useCallback(() => {
        setTerminalLines([]);
        lineIdCounter.current = 0;
    }, []);

    const handleRunCode = useCallback(async () => {
        // This function now correctly uses the latest `code` state
        if (!code.trim()) {
            return;
        }

        clearTerminal();
        setIsLoading(true);
        setError(null);
        setOutput(null);

        try {
            const response = await fetch('http://127.0.0.1:8000/execute/run_sandboxed', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-User': 'rodyherrera'
                },
                body: JSON.stringify({ 
                    code: code, // Uses the `code` from state, which is up-to-date
                    language: language,
                    timeout: 30
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Server error: ${response.status}`);
            }

            const resultData: ExecutionResponse = await response.json();
            setOutput(resultData);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown network error';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [code, language, clearTerminal]);

    // Create a ref to hold the `handleRunCode` function.
    // This allows the `onMount` callback to always access the latest version of the function.
    const handleRunCodeRef = useRef(handleRunCode);
    useEffect(() => {
        handleRunCodeRef.current = handleRunCode;
    }, [handleRunCode]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'j') {
                event.preventDefault();
                const newVisible = !isVisible;
                setIsVisible(newVisible);
                onToggle?.(newVisible);
            }
            
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && isVisible) {
                event.preventDefault();
                handleRunCode(); // This works because `handleRunCode` is a dependency of this useEffect
            }
            
            if ((event.ctrlKey || event.metaKey) && event.key === 'k' && isVisible) {
                event.preventDefault();
                clearTerminal();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isVisible, onToggle, handleRunCode, clearTerminal]);

    const handleEditorChange = useCallback((value: string | undefined) => {
        if (value !== undefined) {
            setCode(value);
        }
    }, []);

    useEffect(() => {
        if (isLoading) return;

        if (error) {
            addTerminalLine(`${error}`, 'error');
            return;
        }

        if (output) {
            // Stdout
            if (output.stdout) {
                output.stdout.split('\n').forEach(line => {
                    if (line.trim()) addTerminalLine(line, 'stdout');
                });
            }
            
            // Stderr
            if (output.stderr) {
                output.stderr.split('\n').forEach(line => {
                    if (line.trim()) addTerminalLine(line, 'stderr');
                });
            }
        }
    }, [output, error, isLoading, addTerminalLine]);

    const editorOptions = useMemo(() => ({
        selectOnLineNumbers: true,
        minimap: { enabled: false },
        fontSize: 14,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: 'on' as const,
        lineNumbers: 'on' as const,
        renderWhitespace: 'selection' as const,
        bracketPairColorization: { enabled: true },
        foldingStrategy: 'indentation' as const,
        showFoldingControls: 'always' as const,
    }), []);

    if (!isVisible) {
        return null;
    }

    return (
        <EditorWidget 
            ref={editorWidgetRef} 
            className={`monaco-editor-container ${theme}`}
        >
            <Editor
                height="100%"
                language={language}
                theme={theme}
                value={code}
                className='monaco-editor'
                options={editorOptions}
                onChange={handleEditorChange}
                onMount={(editor, monaco) => {
                    editorRef.current = editor;
                    
                    // The editor command now calls the function through the ref,
                    // ensuring it's always the latest version.
                    editor.addCommand(
                        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, 
                        () => handleRunCodeRef.current()
                    );
                    
                    editor.addCommand(
                        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, 
                        clearTerminal
                    );
                }}
            />
            
            <div 
                ref={outputPaneRef} 
                className="terminal-container" 
                style={{ 
                    height: `${outputHeight}px`,
                    borderTop: `1px solid ${theme === 'vs-dark' ? '#333' : '#ccc'}`,
                    minHeight: '150px',
                }}
            >
                <div className="terminal-content">
                    {terminalLines.map((line) => (
                        <div 
                            key={line.id} 
                            className={`terminal-line terminal-line-${line.type}`}
                        >
                            <span className="terminal-text">
                                {line.text || '\u00A0'} 
                            </span>
                        </div>
                    ))}
                    <div ref={terminalEndRef} />
                </div>
            </div>
        </EditorWidget>
    );
};

export default MonacoEditor;
