import WindowControls from '@/shared/ui/components/WindowControls';
import { Skeleton } from '@heroui/react';

// Code cells of a few lines each, as their editors draw them (13px font on 18px lines, 10px padding).
const CELL_SKELETON_LINES = [
    ['36%', '58%'],
    ['44%', '30%', '62%', '24%'],
    ['52%']
];

// The notebook as it opens: the header (back, title over save state, kernel status, run, interrupt,
// restart, the desktop window's controls), then its code cells, each with the run button in the gutter.
const NotebookEditorSkeleton = () => (
    <div className='flex h-full w-full min-w-0 flex-col' role='status' aria-label='Opening the notebook'>
        <div className='volt-drag-region flex items-center gap-2 px-3 py-2.5'>
            <Skeleton className='size-9 shrink-0 rounded-full' />
            <div className='flex min-w-0 flex-1 flex-col'>
                <span className='flex h-6 items-center'>
                    <Skeleton className='h-3.5 w-44 rounded-md' />
                </span>
                <span className='flex h-4 items-center'>
                    <Skeleton className='h-2.5 w-14 rounded-md' />
                </span>
            </div>
            <Skeleton className='h-6 w-16 shrink-0 rounded-full' />
            <Skeleton className='size-9 shrink-0 rounded-full' />
            <Skeleton className='size-9 shrink-0 rounded-full' />
            <Skeleton className='size-9 shrink-0 rounded-full' />
            <WindowControls />
        </div>
        <div className='mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-6'>
            {CELL_SKELETON_LINES.map((lines, cellIndex) => (
                <div className='flex items-start gap-2' key={cellIndex}>
                    <div className='flex w-12 shrink-0 flex-col items-center pt-1'>
                        <Skeleton className='size-8 rounded-full' />
                    </div>
                    <div className='flex min-w-0 flex-1 flex-col rounded-xl border border-foreground/8 px-3 py-2.5'>
                        {lines.map((width, lineIndex) => (
                            <span className='flex h-[18px] items-center' key={lineIndex}>
                                <Skeleton className='h-2.5 rounded-md' style={{ width }} />
                            </span>
                        ))}
                    </div>
                    {/* The cell's toolbar column, which only shows on hover. */}
                    <div className='w-9 shrink-0' />
                </div>
            ))}
        </div>
    </div>
);

export default NotebookEditorSkeleton;
