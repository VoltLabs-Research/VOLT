import { useStartAccessedPagesStore } from '../../../stores/use-start-accessed-pages-store';
import { useStartPageEntrance } from '../../../hooks/use-start-page-entrance';
import StartPageTile from '../../molecules/StartPageTile';
import './StartPage.css';
import { useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import UserInfo from '@/modules/auth/components/atoms/UserInfo';
import Button from '@/shared/presentation/components/Button';
import EmptyState from '@/shared/presentation/components/EmptyState';
import useTip from '@/shared/tips/use-tip';

export default function StartPage() {
    const user = useCurrentUser();
    const pages = useStartAccessedPagesStore((state) => state.pages);
    const clearAll = useStartAccessedPagesStore((state) => state.clearAll);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useTip('start-page-history');

    useStartPageEntrance(wrapperRef, pages.length);

    const handleClearHistory = () => {
        const shouldClearHistory = window.confirm('Clear your recent page history? Saved previews will be removed from this device.');

        if (!shouldClearHistory) {
            return;
        }

        clearAll();
    };

    return (
        <div className="metro-start-screen">
            <header className="metro-header">
                <UserInfo
                    user={user}
                    showStatus={true}
                    isOnline={true}
                    className="metro-user-info"
                />

                {pages.length > 0 && (
                    <Button
                        onClick={handleClearHistory}
                        variant="ghost"
                        intent="neutral"
                        leftIcon={<Trash2 size={18} />}
                    >
                        Clear History
                    </Button>
                )}
            </header>

            <main className="metro-content">
                <h1 className="metro-title">Start</h1>

                {pages.length === 0 ? (
                    <EmptyState
                        className='metro-empty-state-card'
                        title='No recent pages yet'
                        description='Open dashboards, analyses, whiteboards, or settings and they will show up here with quick-return previews on this device.'
                    />
                ) : (
                    <div className="metro-grid-wrapper" ref={wrapperRef}>
                        <div className="metro-grid">
                            {pages.map((page) => (
                                <StartPageTile key={page.path} page={page} />
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
