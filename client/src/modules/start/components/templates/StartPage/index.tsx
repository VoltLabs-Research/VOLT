import { useStartAccessedPagesStore } from '../../../stores/use-start-accessed-pages-store';
import { useStartPageEntrance } from '../../../hooks/use-start-page-entrance';
import StartPageTile from '../../molecules/StartPageTile';
import './StartPage.css';
import { useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import UserInfo from '@/modules/auth/components/atoms/UserInfo';
import Button from '@/shared/presentation/components/Button';

export default function StartPage() {
    const user = useCurrentUser();
    const pages = useStartAccessedPagesStore((state) => state.pages);
    const clearAll = useStartAccessedPagesStore((state) => state.clearAll);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useStartPageEntrance(wrapperRef, pages.length);

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
                        onClick={clearAll}
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
                    <p className="metro-empty-state">
                        You have not visited pages yet. <br />
                        As you navigate through the application, your recent pages will appear here.
                    </p>
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
