import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Editor from '@monaco-editor/react';

import EditorWidget from '../EditorWidget';
import type { EditorWidgetRef } from '../EditorWidget';
import './MonacoEditor.css';

// Interfaces (sin cambios)
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
    folderId: string | null;
    currentTimestamp: number;
}

interface TerminalLine {
    id: number;
    text: string;
    type: 'stdout' | 'stderr' | 'info' | 'success' | 'error';
}

const MonacoEditor: React.FC<MonacoEditorProps> = ({ 
    defaultVisible = false,
    onToggle,
    folderId,
    currentTimestamp
}) => {
    // State and basic refs
    const [isVisible, setIsVisible] = useState(defaultVisible);
    const [code, setCode] = useState<string>(
        '# The "context" variable is preloaded with data from the current timestep.\n# Try printing it to see the available data.\n\nprint(context[\'dislocations\'][\'summary\'])'
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
    
    // Ref para almacenar los parámetros más recientes y evitar cierres rancios
    const executionParamsRef = useRef({ folderId, currentTimestamp, code, language });

    useEffect(() => {
        executionParamsRef.current = { folderId, currentTimestamp, code, language };
    }, [folderId, currentTimestamp, code, language]);

    // Funciones de terminal
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

    // `handleRunCode` con las correcciones
    const handleRunCode = useCallback(async () => {
        const params = executionParamsRef.current;
        
        // MEJORA: Validar que se ha seleccionado una carpeta
        if (!params.folderId) {
            clearTerminal();
            addTerminalLine("Please select a data folder before running.", "error");
            return;
        }
        
        if (!params.code.trim()) {
            return;
        }

        clearTerminal();
        setIsLoading(true);
        setError(null);
        setOutput(null);

        try {
            const contextData = {
                folder_id: params.folderId,
                timestep: params.currentTimestamp,
            };
            
            const response = await fetch('http://127.0.0.1:8000/execute/run_sandboxed', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-User': 'rodyherrera'
                },
                body: JSON.stringify({ 
                    code: params.code,
                    language: params.language,
                    timeout: 30,
                    context_data: contextData
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
    }, [clearTerminal, addTerminalLine]); // Se añade addTerminalLine como dependencia

    // Ref para la función `handleRunCode`
    const handleRunCodeRef = useRef(handleRunCode);
    useEffect(() => {
        handleRunCodeRef.current = handleRunCode;
    }, [handleRunCode]);

    // Atajos de teclado
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
                handleRunCodeRef.current(); // Llama a la función a través del ref
            }
            if ((event.ctrlKey || event.metaKey) && event.key === 'k' && isVisible) {
                event.preventDefault();
                clearTerminal();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isVisible, onToggle, clearTerminal]); // handleRunCode se quita porque se usa el ref

    const handleEditorChange = useCallback((value: string | undefined) => {
        if (value !== undefined) {
            setCode(value);
        }
    }, []);
    
    // Procesamiento de salida
    useEffect(() => {
        if (isLoading) return;

        if (error) {
            addTerminalLine(`${error}`, 'error');
            return;
        }

        console.log(output)

        if (output) {
            if (output.stdout) {
                output.stdout.split('\n').forEach(line => {
                    if (line) addTerminalLine(line, 'stdout');
                });
            }
            if (output.stderr) {
                output.stderr.split('\n').forEach(line => {
                    if (line) addTerminalLine(line, 'stderr');
                });
            }
            if (output.result !== null && output.result !== undefined) {
                addTerminalLine('--- Result ---', 'info');
                const resultString = JSON.stringify(output.result, null, 2);
                addTerminalLine(resultString, 'success');
            }
        }
    }, [output, error, isLoading, addTerminalLine]);
    
    // Opciones del editor
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