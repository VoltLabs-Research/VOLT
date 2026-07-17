import { useOutletContext } from 'react-router-dom';
import type { FolderBreadcrumbItem } from '@/shared/ui/hooks/use-folder-breadcrumbs';

export interface DashboardGlobalSearchBreadcrumb {
    items: FolderBreadcrumbItem[];
    onNavigate: (folderId: string | null) => void;
}

export interface DashboardHeaderContext {
    setGlobalSearchBreadcrumb: (breadcrumb: DashboardGlobalSearchBreadcrumb | null) => void;
}

const useDashboardHeaderContext = () => {
    return useOutletContext<DashboardHeaderContext>();
};

export default useDashboardHeaderContext;
