import EditableTag from '@/shared/ui/components/EditableTag';
import { cn } from '@heroui/react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface SimulationFolderDraftCardProps {
    onCreate: (name: string) => Promise<void>;
    onDiscard: () => void;
}

// A folder card that does not exist yet, with its name already being edited. Enter or leaving
// the field creates the folder; Escape, or leaving it empty, takes the card away.
export default function SimulationFolderDraftCard({ onCreate, onDiscard }: SimulationFolderDraftCardProps) {
    const cardRef = useRef<HTMLElement>(null);
    const savingRef = useRef(false);
    const [isEditing, setIsEditing] = useState(true);
    const [pendingName, setPendingName] = useState<string | null>(null);

    useEffect(() => {
        cardRef.current?.scrollIntoView({ block: 'nearest' });
    }, []);

    const handleSave = useCallback((name: string) => {
        savingRef.current = true;
        setPendingName(name);

        void (async () => {
            try{
                await onCreate(name);
            }catch{
                // The toast already reported it; the draft goes either way.
            }finally{
                onDiscard();
            }
        })();
    }, [onCreate, onDiscard]);

    // EditableTag ends the edit before it hands over the name, so the discard waits a tick
    // to see whether a save followed.
    const handleEditingChange = useCallback((nextValue: boolean) => {
        setIsEditing(nextValue);
        if (nextValue) return;

        queueMicrotask(() => {
            if (!savingRef.current) onDiscard();
        });
    }, [onDiscard]);

    return (
        <article
            ref={cardRef}
            className={cn(
                'relative flex h-full min-h-64 flex-col rounded-3xl border border-transparent bg-foreground/4 p-2',
                pendingName !== null && 'opacity-60'
            )}
            aria-label='New folder'
            aria-busy={pendingName !== null}
        >
            <div aria-hidden='true' className='relative flex min-h-40 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-foreground/5 px-4 text-center text-sm text-muted'>
                No trajectories yet
            </div>
            <div className='flex min-w-0 flex-col gap-1 px-2 pt-3 pb-1.5'>
                {pendingName !== null ? (
                    <h3 className='truncate text-sm font-medium text-foreground'>{pendingName}</h3>
                ) : (
                    <EditableTag
                        as='h3'
                        className="-mx-1 max-w-full px-1 text-sm font-medium text-foreground empty:before:text-muted empty:before:content-['Folder_name']"
                        editing={isEditing}
                        onEditingChange={handleEditingChange}
                        onSave={handleSave}
                        title='Folder name'
                    >
                        {''}
                    </EditableTag>
                )}
                <p className='truncate text-xs text-muted'>Press Enter to create, Esc to cancel</p>
            </div>
        </article>
    );
}
