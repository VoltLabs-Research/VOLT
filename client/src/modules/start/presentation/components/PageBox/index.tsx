import type { AccessedPage } from '@/shared/presentation/stores/use-accessed-pages-store';
import { useAccessedPagesStore } from '@/shared/presentation/stores/use-accessed-pages-store';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PageBoxProps {
    page: AccessedPage;
}

const PageBox = ({ page }: PageBoxProps) => {
    const removePage = useAccessedPagesStore((state) => state.removePage);
    const navigate = useNavigate();

    const handleRemove = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        removePage(page.path);
    };

    const handleClick = () => {
        navigate(page.path);
    };

    const timeAgo = Math.floor((Date.now() - page.lastAccessed) / 60000);
    const timeString = timeAgo < 1 ? 'Just now' : `${timeAgo}m ago`;

    return (
        <div className="metro-tile" onClick={handleClick}>
            {page.snapshot && (
                <div className="metro-tile-preview-container">
                    <iframe
                        srcDoc={page.snapshot}
                        sandbox=""
                        className="metro-tile-iframe"
                        scrolling="no"
                        tabIndex={-1}
                    />
                </div>
            )}

            <div className="metro-tile-overlay">
                <h3 className="metro-tile-name">{page.title}</h3>
                <span className="metro-tile-time">{timeString}</span>
            </div>

            <button
                onClick={handleRemove}
                title="Remove from history"
                className="metro-tile-close"
            >
                <X size={16} />
            </button>
        </div>
    );
};

export default PageBox;
