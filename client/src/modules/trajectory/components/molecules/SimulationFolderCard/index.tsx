import type { TrajectoryFolderRow } from '@/modules/trajectory/utilities/listing';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import { ChevronRight, Folder } from 'lucide-react';
import { useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import './SimulationFolderCard.css';

interface SimulationFolderCardProps {
    folder: TrajectoryFolderRow;
    onOpen: (folderId: string) => void;
};

export default function SimulationFolderCard({ folder, onOpen }: SimulationFolderCardProps) {
    const handleOpen = useCallback(() => {
        onOpen(folder._id);
    }, [folder._id, onOpen]);

    const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        event.preventDefault();
        onOpen(folder._id);
    }, [folder._id, onOpen]);

    return (
        <article
            className='simulation-folder-card radius-md b-soft p-1-5 cursor-pointer'
            onClick={handleOpen}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role='button'
            aria-label={`Open folder ${folder.title}`}
        >
            <Container className='simulation-folder-card__content d-flex column gap-1-5 h-max'>
                <Container className='simulation-folder-card__icon d-flex flex-center'>
                    <Folder size={28} strokeWidth={1.75} />
                </Container>

                <Container className='d-flex column gap-05 flex-1'>
                    <Title className='font-size-4 font-weight-5 color-primary text-truncate'>
                        {folder.title}
                    </Title>
                    <Paragraph className='font-size-2 color-secondary simulation-folder-card__description'>
                        Organize trajectories and drag files here to move them into this folder.
                    </Paragraph>
                </Container>

                <Container className='simulation-folder-card__footer d-flex items-center gap-05 color-secondary font-size-2'>
                    <span>Open folder</span>
                    <ChevronRight size={14} strokeWidth={2} />
                </Container>
            </Container>
        </article>
    );
}
