import type { NotebookDeletedEventPayload } from '@modules/scripting/contracts/domain/events';

declare global {
    interface EventMap {
        'notebook.deleted': NotebookDeletedEventPayload;
    }
}
