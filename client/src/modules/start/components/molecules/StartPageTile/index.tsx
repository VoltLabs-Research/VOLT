import { useStartPageTile } from '../../../hooks/use-start-page-tile';
import './StartPageTile.css';
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

    const timeAgo = Math.floor((Date.now() - page.lastAccessed) / 60000);
    const timeString = timeAgo < 1 ? 'Just now' : `${timeAgo}m ago`;

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
                aria-label={`Open ${page.title}`}
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
                    <h3 className='metro-tile-name'>{page.title}</h3>
                    <span className='metro-tile-time'>{timeString}</span>
                </div>
            </button>

            <button
                onClick={handleRemove}
                type='button'
                title='Remove from history'
                aria-label={`Remove ${page.title} from history`}
                className='metro-tile-close'
            >
                <X size={16} />
            </button>
        </div>
    );
}
