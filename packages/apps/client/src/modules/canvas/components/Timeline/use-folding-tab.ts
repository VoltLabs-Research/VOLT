import { useEffect, useState } from 'react';

// As long as the panel's fold transition in Timeline.
export const PANEL_FOLD_MS = 420;

// While the panel folds away it keeps showing the tab that was open. Afterwards the tab unmounts, so a closed
// panel holds no table that keeps fetching.
const useFoldingTab = (activeTab: string | null): string | null => {
    const [heldTab, setHeldTab] = useState(activeTab);
    if (activeTab !== null && activeTab !== heldTab) setHeldTab(activeTab);

    useEffect(() => {
        if (activeTab !== null) return;
        const timer = window.setTimeout(() => setHeldTab(null), PANEL_FOLD_MS);
        return () => window.clearTimeout(timer);
    }, [activeTab]);

    return activeTab ?? heldTab;
};

export default useFoldingTab;
