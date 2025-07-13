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
`'''
Access the full analysis for each timestep through the \`context\` variable. This variable is automatically populated with all data from the OpenDXA dislocation analysis, ready for your script.
'''

import numpy as np

dislocation_info = context['dislocations']
metadata = dislocation_info['metadata']
summary = dislocation_info['summary']
dislocation_data = dislocation_info['data']

segment_count = metadata['count']
total_length = summary['total_length']

print('Dislocation Analysis Summary')
print(f'Total Dislocation Segments: {segment_count}')
print(f'Total Dislocation Length: {total_length:.4f} (units)')

segment_lengths = np.array([segment['length'] for segment in dislocation_data])

print('Segment Length Statistics')
print(f'Longest Segment: {np.max(segment_lengths):.4f}')
print(f'Shortest Segment: {np.min(segment_lengths):.4f}')
print(f'Average Segment Length: {np.mean(segment_lengths):.4f}')

result = {
    'analysis_summary': {
        'segment_count': segment_count,
        'total_length': round(total_length, 4)
    },
    'length_stats': {
        'max': round(float(np.max(segment_lengths)), 4),
        'min': round(float(np.min(segment_lengths)), 4),
        'mean': round(float(np.mean(segment_lengths)), 4)
    }
}

print(result)`
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
    
    const executionParamsRef = useRef({ folderId, currentTimestamp, code, language });

    useEffect(() => {
        executionParamsRef.current = { folderId, currentTimestamp, code, language };
    }, [folderId, currentTimestamp, code, language]);

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
        const params = executionParamsRef.current;
        
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
    }, [clearTerminal, addTerminalLine]);

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
                handleRunCodeRef.current(); // Llama a la función a través del ref
            }
            if ((event.ctrlKey || event.metaKey) && event.key === 'k' && isVisible) {
                event.preventDefault();
                clearTerminal();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isVisible, onToggle, clearTerminal]); 

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