import HtmlOutputFrame from './HtmlOutputFrame';
import Prose from '@/shared/ui/components/Prose';
import { mimeText, terminalText, textOf } from '@/modules/scripting/utils/notebook-document';
import type { NotebookMimeBundle, NotebookOutput } from '@volt/contracts/modules/scripting/domain';
import { cn } from '@heroui/react';

interface CellOutputsProps {
    outputs: NotebookOutput[];
}

const TEXT_CLASS = 'm-0 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed';

// The representation a notebook shows of what a cell displayed: the richest it can, as Jupyter
// picks it.
const MimeView = ({ data }: { data: NotebookMimeBundle }) => {
    const html = mimeText(data, 'text/html');
    if(html !== null){
        return <HtmlOutputFrame html={html} />;
    }
    for(const mime of ['image/png', 'image/jpeg']){
        const image = mimeText(data, mime);
        if(image !== null){
            return <img alt='Cell output' src={`data:${mime};base64,${image.replace(/\s/g, '')}`} className='block h-auto max-w-full' />;
        }
    }
    const svg = mimeText(data, 'image/svg+xml');
    if(svg !== null){
        return <img alt='Cell output' src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} className='block h-auto max-w-full' />;
    }
    const markdown = mimeText(data, 'text/markdown');
    if(markdown !== null){
        return <Prose>{markdown}</Prose>;
    }
    if(data['application/json'] !== undefined && mimeText(data, 'text/plain') === null){
        return <pre className={cn(TEXT_CLASS, 'text-foreground')}>{JSON.stringify(data['application/json'], null, 2)}</pre>;
    }
    const text = mimeText(data, 'text/latex') ?? mimeText(data, 'text/plain');
    return text === null ? null : <pre className={cn(TEXT_CLASS, 'text-foreground')}>{terminalText(text)}</pre>;
};

const OutputView = ({ output }: { output: NotebookOutput }) => {
    switch(output.output_type){
        case 'stream':
            return (
                <pre className={cn(TEXT_CLASS, output.name === 'stderr' ? 'rounded-xl bg-danger/6 px-3 py-2 text-foreground' : 'text-foreground')}>
                    {terminalText(textOf(output.text))}
                </pre>
            );
        case 'error':
            return (
                <pre className={cn(TEXT_CLASS, 'rounded-xl bg-danger/6 px-3 py-2 text-danger-soft-foreground')}>
                    {terminalText(output.traceback.length > 0 ? output.traceback.join('\n') : `${output.ename}: ${output.evalue}`)}
                </pre>
            );
        case 'display_data':
        case 'execute_result':
            return <MimeView data={output.data} />;
    }
};

const CellOutputs = ({ outputs }: CellOutputsProps) => {
    if(outputs.length === 0){
        return null;
    }

    return (
        <div className='flex min-w-0 flex-col gap-1.5' aria-label='Cell output' role='group'>
            {outputs.map((output, index) => (
                <div key={index} className='min-w-0 overflow-hidden'>
                    <OutputView output={output} />
                </div>
            ))}
        </div>
    );
};

export default CellOutputs;
