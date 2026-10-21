import { useCallback } from 'react';
import { sileo } from 'sileo';
import { useWasmCanvasStore } from './store';
import type { FileWithPath } from '@/shared/utils/file';
import type { WasmLoadReport } from './store';

const MAX_LISTED_FILES = 3;

// Named like an upload on the dashboard (use-trajectory-file-picker): the folder, or the file when only one was chosen.
const resolveTrajectoryName = (files: FileWithPath[]): string => {
    const folder = files.find(({ path }) => path.includes('/'))?.path.split('/').filter(Boolean)[0];
    if (folder) return folder;
    if (files.length === 1) return files[0].file.name;
    return `${files.length} files`;
};

const listFiles = (paths: string[]): string => {
    const names = paths.map((path) => path.split('/').pop() ?? path);
    if (names.length <= MAX_LISTED_FILES) return names.join(', ');
    return `${names.slice(0, MAX_LISTED_FILES).join(', ')} and ${names.length - MAX_LISTED_FILES} more`;
};

const reportLeftOut = ({ skipped, duplicateTimesteps }: WasmLoadReport, total: number) => {
    const notes: string[] = [];
    if (skipped.length > 0) {
        notes.push(`Not a trajectory VOLT can read: ${listFiles(skipped.map(({ path }) => path))}.`);
    }
    if (duplicateTimesteps > 0) {
        notes.push(`${duplicateTimesteps} frame${duplicateTimesteps === 1 ? '' : 's'} left out: the timestep was already in another file.`);
    }
    if (notes.length === 0) return;

    sileo.warning({
        title: skipped.length > 0 ? `Skipped ${skipped.length} of ${total} files` : 'Some frames were left out',
        description: notes.join(' ')
    });
};

// Every way of opening files (picker, folder, drop, sample) goes through here. Something that fails
// to load while a trajectory is on screen only gets a toast; the empty state shows the error otherwise.
const useWasmDumpLoader = () => {
    const loadTrajectoryFiles = useWasmCanvasStore((state) => state.loadTrajectoryFiles);
    const loadSampleDump = useWasmCanvasStore((state) => state.loadSampleDump);

    const report = useCallback((result: WasmLoadReport | null, total: number) => {
        if (result) {
            reportLeftOut(result, total);
            return;
        }
        const { parseError, failedFileName, frames } = useWasmCanvasStore.getState();
        if (parseError && frames.length > 0) {
            sileo.error({ title: `Couldn't read ${failedFileName ?? 'the file'}`, description: parseError });
        }
    }, []);

    const openFiles = useCallback(async (files: FileWithPath[]) => {
        if (files.length === 0) return;
        report(await loadTrajectoryFiles({ name: resolveTrajectoryName(files), files }), files.length);
    }, [loadTrajectoryFiles, report]);

    const openSample = useCallback(async () => {
        report(await loadSampleDump(), 1);
    }, [loadSampleDump, report]);

    return { openFiles, openSample };
};

export default useWasmDumpLoader;
