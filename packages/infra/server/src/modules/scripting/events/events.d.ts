import type { NotebookDeletedEventPayload } from '@modules/scripting/contracts/events';

declare global {
    interface EventMap {
        'notebook.deleted': NotebookDeletedEventPayload;
    }
}
