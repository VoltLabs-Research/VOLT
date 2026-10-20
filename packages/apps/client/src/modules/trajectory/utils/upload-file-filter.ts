import type { FileWithPath } from '@/shared/utils/file';

const JUNK_BASENAMES = new Set(['__MACOSX', 'Thumbs.db', 'desktop.ini']);

interface FilteredUploadFiles {
    files: FileWithPath[];
    skippedJunk: number;
    skippedEmpty: number;
};

const getPathSegments = (entry: FileWithPath): string[] => {
    const source = entry.path || entry.file.name;
    return source.split('/').filter((segment) => segment.trim() !== '');
};

const isJunkFile = (entry: FileWithPath): boolean => {
    const segments = getPathSegments(entry);
    if (segments.length === 0) return true;

    return segments.some((segment) => segment.startsWith('.') || JUNK_BASENAMES.has(segment));
};

export const filterUploadableTrajectoryFiles = (files: FileWithPath[]): FilteredUploadFiles => {
    const uploadable: FileWithPath[] = [];
    let skippedJunk = 0;
    let skippedEmpty = 0;

    files.forEach((entry) => {
        if (isJunkFile(entry)) {
            skippedJunk += 1;
            return;
        }

        if (entry.file.size <= 0) {
            skippedEmpty += 1;
            return;
        }

        uploadable.push(entry);
    });

    return {
        files: uploadable,
        skippedJunk,
        skippedEmpty
    };
};

export const describeSkippedUploadFiles = ({ skippedJunk, skippedEmpty }: FilteredUploadFiles): string | null => {
    const reasons: string[] = [];
    if (skippedEmpty > 0) reasons.push(`${skippedEmpty} empty`);
    if (skippedJunk > 0) reasons.push(`${skippedJunk} system`);
    if (reasons.length === 0) return null;

    const total = skippedEmpty + skippedJunk;
    return `Skipped ${reasons.join(' and ')} ${total === 1 ? 'file' : 'files'}.`;
};
