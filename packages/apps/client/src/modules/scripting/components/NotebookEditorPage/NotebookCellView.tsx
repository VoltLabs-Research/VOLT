import CellEditor from './CellEditor';
import CellOutputs from './CellOutputs';
import type { CellCompletion, CellRunMode } from './CellEditor';
import Loader from '@/shared/ui/components/Loader';
import Prose from '@/shared/ui/components/Prose';
import type { EditableCell, NotebookCellType } from '@/modules/scripting/utils/notebook-document';
import { Button, Input, Tooltip, cn } from '@heroui/react';
import { ArrowDown, ArrowUp, Code, FileText, Play, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

interface NotebookCellViewProps {
    cell: EditableCell;
    index: number;
    count: number;
    isRunning: boolean;
    canRun: boolean;
    isEditingText: boolean;
    monacoTheme: string;
    focusRequest: number;
    // The prompt of the input() this cell's execution waits on.
    inputPrompt: { prompt: string; password: boolean } | null;
    onChange: (source: string) => void;
    onRun: (mode: CellRunMode) => void;
    onFocus: () => void;
    onEditText: (isEditing: boolean) => void;
    onRetype: (cellType: NotebookCellType) => void;
    onMove: (offset: number) => void;
    onRemove: () => void;
    onAnswerInput: (text: string) => void;
    complete: (code: string, cursor: number) => Promise<CellCompletion>;
};

const LANGUAGES = { code: 'python', markdown: 'markdown', raw: 'plaintext' } as const;

const ToolbarButton = ({ label, onPress, isDisabled, children }: { label: string; onPress: () => void; isDisabled?: boolean; children: ReactNode }) => (
    <Tooltip>
        <Button size='sm' variant='ghost' isIconOnly aria-label={label} onPress={onPress} isDisabled={isDisabled}>
            {children}
        </Button>
        <Tooltip.Content placement='top'>{label}</Tooltip.Content>
    </Tooltip>
);

const InputPrompt = ({ prompt, password, onSubmit }: { prompt: string; password: boolean; onSubmit: (text: string) => void }) => {
    const [value, setValue] = useState('');
    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit(value);
    };

    return (
        <form className='flex items-center gap-2' onSubmit={handleSubmit}>
            {prompt && <span className='font-mono text-xs text-foreground'>{prompt}</span>}
            <Input
                aria-label={prompt || 'Input for the running cell'}
                type={password ? 'password' : 'text'}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                autoFocus
                className='min-w-0 flex-1 font-mono text-xs'
            />
            <Button size='sm' variant='secondary' type='submit'>Send</Button>
        </form>
    );
};

const NotebookCellView = ({
    cell,
    index,
    count,
    isRunning,
    canRun,
    isEditingText,
    monacoTheme,
    focusRequest,
    inputPrompt,
    onChange,
    onRun,
    onFocus,
    onEditText,
    onRetype,
    onMove,
    onRemove,
    onAnswerInput,
    complete
}: NotebookCellViewProps) => {
    const [isFocused, setIsFocused] = useState(false);
    const isCode = cell.type === 'code';
    const showsRenderedText = cell.type === 'markdown' && !isEditingText;

    const handleFocus = () => {
        setIsFocused(true);
        onFocus();
    };

    let gutter: ReactNode = null;
    if(isCode){
        gutter = (
            <>
                <Tooltip>
                    <Button
                        size='sm'
                        variant='ghost'
                        isIconOnly
                        aria-label='Run cell'
                        isDisabled={!canRun || isRunning}
                        onPress={() => onRun('stay')}
                    >
                        {isRunning ? <Loader size='sm' /> : <Play size={14} />}
                    </Button>
                    <Tooltip.Content placement='left'>Run cell (Shift+Enter runs and moves on)</Tooltip.Content>
                </Tooltip>
                <span className='font-mono text-2xs text-muted' aria-label='Execution count'>
                    [{isRunning ? '*' : cell.executionCount ?? ' '}]
                </span>
            </>
        );
    }

    let body: ReactNode;
    if(showsRenderedText){
        body = (
            <div
                role='button'
                tabIndex={0}
                aria-label='Edit markdown cell'
                className='cursor-text px-3 py-2'
                onDoubleClick={() => onEditText(true)}
                onKeyDown={(event) => {
                    if(event.key === 'Enter'){
                        event.preventDefault();
                        onEditText(true);
                    }
                }}
            >
                {cell.source.trim()
                    ? <Prose>{cell.source}</Prose>
                    : <p className='m-0 text-sm text-muted'>Empty text cell. Double-click to write in Markdown.</p>}
            </div>
        );
    }else{
        body = (
            <div className={cn('overflow-hidden rounded-lg border bg-background transition-colors', isFocused ? 'border-focus' : 'border-border')}>
                <CellEditor
                    cellId={cell.id}
                    value={cell.source}
                    language={LANGUAGES[cell.type]}
                    theme={monacoTheme}
                    focusRequest={focusRequest}
                    onChange={onChange}
                    onRun={onRun}
                    onFocus={handleFocus}
                    onBlur={() => setIsFocused(false)}
                    complete={complete}
                />
            </div>
        );
    }

    return (
        <section className='group/cell flex items-start gap-2' aria-label={`Cell ${index + 1} of ${count}`}>
            <div className='flex w-12 shrink-0 flex-col items-center gap-0.5 pt-1'>
                {gutter}
            </div>
            <div className='flex min-w-0 flex-1 flex-col gap-2'>
                {body}
                {isCode && <CellOutputs outputs={cell.outputs} />}
                {inputPrompt && (
                    <InputPrompt prompt={inputPrompt.prompt} password={inputPrompt.password} onSubmit={onAnswerInput} />
                )}
            </div>
            <div className='flex shrink-0 flex-col items-center gap-0.5 opacity-0 transition-opacity group-hover/cell:opacity-100 group-focus-within/cell:opacity-100'>
                <ToolbarButton label={isCode ? 'Make a text cell' : 'Make a code cell'} onPress={() => onRetype(isCode ? 'markdown' : 'code')}>
                    {isCode ? <FileText size={14} /> : <Code size={14} />}
                </ToolbarButton>
                <ToolbarButton label='Move up' onPress={() => onMove(-1)} isDisabled={index === 0}>
                    <ArrowUp size={14} />
                </ToolbarButton>
                <ToolbarButton label='Move down' onPress={() => onMove(1)} isDisabled={index === count - 1}>
                    <ArrowDown size={14} />
                </ToolbarButton>
                <ToolbarButton label='Delete cell' onPress={onRemove}>
                    <Trash2 size={14} />
                </ToolbarButton>
            </div>
        </section>
    );
};

export default NotebookCellView;
