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

type CrudAction =
    | 'Creating'
    | 'Deleting'
    | 'Renaming'
    | 'Moving'
    | 'Saving'
    | 'Downloading'
    | 'Starting'
    | 'Stopping'
    | 'Restarting';

interface CreateCrudToastOptionsInput {
    action: CrudAction;
    subject: string;
    success?: string;
}

const ACTION_FORMS: Record<CrudAction, { past: string; base: string }> = {
    Creating:    {
        past: 'created',
        base: 'create'
    },
    Deleting:    {
        past: 'deleted',
        base: 'delete'
    },
    Renaming:    {
        past: 'renamed',
        base: 'rename'
    },
    Moving:      {
        past: 'moved',
        base: 'move'
    },
    Saving:      {
        past: 'saved',
        base: 'save'
    },
    Downloading: {
        past: 'downloaded',
        base: 'download'
    },
    Starting:    {
        past: 'started',
        base: 'start'
    },
    Stopping:    {
        past: 'stopped',
        base: 'stop'
    },
    Restarting:  {
        past: 'restarted',
        base: 'restart'
    }
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
    success
}: CreateCrudToastOptionsInput): PromiseToastOptions => {
    const { past, base } = ACTION_FORMS[action];
    const normalizedSubject = subject.trim();
    const lowerSubject = normalizedSubject.toLowerCase();

    return createPromiseToastOptions({
        loading: `${action} ${lowerSubject}...`,
        success: success ?? `${normalizedSubject} ${past} successfully`,
        error: `Failed to ${base} ${lowerSubject}`
    });
};
