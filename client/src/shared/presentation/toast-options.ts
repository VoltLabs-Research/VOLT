import type { SileoOptions } from 'sileo';

export interface PromiseToastOptions<T = unknown> {
    loading: SileoOptions;
    success: SileoOptions | ((data: T) => SileoOptions);
    error: SileoOptions;
}

interface CreatePromiseToastOptionsInput {
    loading: string;
    success: string;
    error: string;
}

export type CrudAction =
    | 'Creating'
    | 'Updating'
    | 'Deleting'
    | 'Renaming'
    | 'Moving'
    | 'Saving'
    | 'Downloading'
    | 'Uploading'
    | 'Starting'
    | 'Stopping'
    | 'Restarting'
    | 'Archiving'
    | 'Restoring'
    | 'Revoking'
    | 'Sharing'
    | 'Publishing'
    | 'Copying';

interface CreateCrudToastOptionsInput {
    action: CrudAction;
    subject: string;
    success?: string;
    error?: string;
}

const ACTION_FORMS: Record<CrudAction, { past: string; base: string }> = {
    Creating:    { past: 'created',    base: 'create' },
    Updating:    { past: 'updated',    base: 'update' },
    Deleting:    { past: 'deleted',    base: 'delete' },
    Renaming:    { past: 'renamed',    base: 'rename' },
    Moving:      { past: 'moved',      base: 'move' },
    Saving:      { past: 'saved',      base: 'save' },
    Downloading: { past: 'downloaded', base: 'download' },
    Uploading:   { past: 'uploaded',   base: 'upload' },
    Starting:    { past: 'started',    base: 'start' },
    Stopping:    { past: 'stopped',    base: 'stop' },
    Restarting:  { past: 'restarted',  base: 'restart' },
    Archiving:   { past: 'archived',   base: 'archive' },
    Restoring:   { past: 'restored',   base: 'restore' },
    Revoking:    { past: 'revoked',    base: 'revoke' },
    Sharing:     { past: 'shared',     base: 'share' },
    Publishing:  { past: 'published',  base: 'publish' },
    Copying:     { past: 'copied',     base: 'copy' }
};

export const createPromiseToastOptions = ({
    loading,
    success,
    error
}: CreatePromiseToastOptionsInput): PromiseToastOptions => ({
    loading: { title: loading },
    success: { title: success },
    error: { title: error }
});

export const createCrudToastOptions = ({
    action,
    subject,
    success,
    error
}: CreateCrudToastOptionsInput): PromiseToastOptions => {
    const { past, base } = ACTION_FORMS[action];
    const normalizedSubject = subject.trim();
    const lowerSubject = normalizedSubject.toLowerCase();

    return createPromiseToastOptions({
        loading: `${action} ${lowerSubject}...`,
        success: success ?? `${normalizedSubject} ${past}`,
        error: error ?? `Failed to ${base} ${lowerSubject}`
    });
};
