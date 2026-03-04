import UserInfo from '@/modules/auth/presentation/components/atoms/UserInfo';
import Button from '@/shared/presentation/components/Button';
import PageBox from '../../components/PageBox';
import { useAuthStore } from '@/modules/auth/presentation/stores/use-auth-store';
import { useAccessedPagesStore } from '@/shared/presentation/stores/use-accessed-pages-store';
import { Trash2 } from 'lucide-react';
import './StartPage.css';

const StartPage = () => {
    const user = useAuthStore((state) => state.user);
    const pages = useAccessedPagesStore((state) => state.pages);
    const clearAll = useAccessedPagesStore((state) => state.clearAll);

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
                        You have not visited any pages yet. <br />
                        As you navigate through the application, your recent pages will appear here.
                    </p>
                ) : (
                    <div className="metro-grid">
                        {pages.map((page) => (
                            <PageBox key={page.path} page={page} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default StartPage;
