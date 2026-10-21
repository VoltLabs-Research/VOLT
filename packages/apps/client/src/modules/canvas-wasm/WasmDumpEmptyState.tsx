import Loader from '@/shared/ui/components/Loader';
import { Button } from '@heroui/react';
import { AlertTriangle, FileUp } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useWasmCanvasStore } from './store';

interface WasmDumpEmptyStateProps {
    onChooseFolder: () => void;
    onTrySample: () => void;
}

// What /canvas/wasm shows until a file is loaded (open, reading, could-not-read), laid out like the
// app's RecoveryState so it reads as part of the canvas rather than a dialog. A browser dialog picks
// either files or a folder, so the button opens a folder and single files are dropped (or opened from
// the File menu). The C++ readers decide from the contents which files are trajectories.
const WasmDumpEmptyState = ({ onChooseFolder, onTrySample }: WasmDumpEmptyStateProps) => {
    const { isParsing, parsingFileName, parseError, failedFileName } = useWasmCanvasStore(useShallow((state) => ({
        isParsing: state.isParsing,
        parsingFileName: state.parsingFileName,
        parseError: state.parseError,
        failedFileName: state.failedFileName
    })));
    const hasError = !isParsing && Boolean(parseError);

    const title = isParsing
        ? `Reading ${parsingFileName ?? 'file'}…`
        : hasError
            ? `Couldn't read ${failedFileName ?? 'the file'}`
            : 'Open a trajectory';
    const description = isParsing
        ? 'Reading the frames in this tab.'
        : hasError
            ? parseError
            : 'Plugins run in this tab with WebAssembly. Your files never leave your computer.';

    return (
        <section
            aria-labelledby='wasm-dump-empty-state-title'
            aria-busy={isParsing}
            className='flex h-full w-full flex-col items-center justify-center p-6'
        >
            <div className='flex max-w-[360px] flex-col items-center gap-6 text-center'>
                <div className='flex flex-col items-center justify-center text-muted'>
                    {isParsing
                        ? <Loader size='md' color='current' aria-label='Reading file' />
                        : hasError
                            ? <AlertTriangle size={26} strokeWidth={1.5} aria-hidden='true' />
                            : <FileUp size={26} strokeWidth={1.5} aria-hidden='true' />}
                </div>

                <div className='flex flex-col gap-2'>
                    <h2 id='wasm-dump-empty-state-title' className='break-all text-base font-medium text-foreground'>
                        {title}
                    </h2>
                    <p className='text-sm leading-normal text-muted' aria-live='polite'>
                        {description}
                    </p>
                </div>

                {!isParsing && (
                    <div className='flex flex-col items-center gap-3'>
                        <div className='flex flex-row flex-wrap items-center justify-center gap-2'>
                            <Button variant='primary' size='sm' onPress={onChooseFolder}>
                                {hasError ? 'Choose another folder' : 'Choose folder'}
                            </Button>
                            <Button variant='ghost' size='sm' onPress={onTrySample}>
                                Try a sample
                            </Button>
                        </div>
                        <p className='text-xs text-muted'>
                            or drop files or a folder anywhere
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
};

export default WasmDumpEmptyState;
