import { getDashboardNavigationItems } from '@/app/routes/metadata';
import { DashboardNavigationSection } from '@/app/routes/types';
import useVisibleNavigationItems from '@/modules/dashboard/hooks/use-visible-navigation-items';

const SETTINGS_NAVIGATION_ITEMS = getDashboardNavigationItems(DashboardNavigationSection.Settings);
const FALLBACK_SETTINGS_PATH = '/dashboard/settings/general';

// Where "Settings" opens: its first page this workspace shows.
const useDefaultSettingsPath = (): string => {
    const visibleNavigationItems = useVisibleNavigationItems();

    return visibleNavigationItems(SETTINGS_NAVIGATION_ITEMS)[0]?.path ?? FALLBACK_SETTINGS_PATH;
};

export default useDefaultSettingsPath;
