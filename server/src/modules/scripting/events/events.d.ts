import type { NotebookDeletedEventPayload } from '@modules/scripting/events/NotebookDeletedEvent';

declare global {
    interface EventMap {
        'notebook.deleted': NotebookDeletedEventPayload;
    }
}
