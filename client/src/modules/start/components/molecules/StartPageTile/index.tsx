import Heading from '@/shared/presentation/primitives/Heading';
import { useStartPageTile } from '../../../hooks/use-start-page-tile';
import './StartPageTile.css';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { X } from 'lucide-react';
import type { AccessedPage } from '../../../stores/use-start-accessed-pages-store';

interface StartPageTileProps {
    page: AccessedPage;
};

export default function StartPageTile({ page }: StartPageTileProps) {
    const {
        tileRef,
        iframeScale,
        handleClick,
        handleMouseEnter,
        handleMouseLeave,
        handleMouseMove,
        handleRemove
    } = useStartPageTile(page.path);

    const lastOpenedDate = new Date(page.lastAccessed);
    const timeString = Date.now() - page.lastAccessed < 60_000
        ? 'Just now'
        : formatDistanceToNowStrict(lastOpenedDate, { addSuffix: true });
    const lastOpenedExact = format(lastOpenedDate, "MMM d, yyyy 'at' h:mm a");

    const previewLabel = page.snapshot ? 'Preview available' : 'Preview unavailable';

    return (
        <div
            ref={tileRef}
            className='metro-tile-shell'
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onMouseEnter={handleMouseEnter}
        >
            <button
                type='button'
                className='metro-tile'
                onClick={handleClick}
                aria-label={`Open ${page.title}. ${previewLabel}. Last opened ${timeString}.`}
                title={`${page.title} - last opened ${lastOpenedExact}`}
            >
                {page.snapshot && (
                    <div
                        className='metro-tile-preview-container'
                        style={{ transform: `scale(${iframeScale})` }}
                    >
                        <iframe
                            srcDoc={page.snapshot}
                            sandbox=''
                            className='metro-tile-iframe'
                            scrolling='no'
                            tabIndex={-1}
                            aria-hidden='true'
                        />
                    </div>
                )}

                <div className='metro-tile-shine' />

                <div className='metro-tile-overlay'>
                    <Heading level={3} className='metro-tile-name'>{page.title}</Heading>
                    <span className='metro-tile-time'>{timeString}</span>
                </div>
            </button>

            <button onClick={handleRemove} type='button' title='Remove from history' aria-label={`Remove ${page.title} from history`} className='metro-tile-close'>
                <X size={16} />
            </button>
        </div>
    );
}
