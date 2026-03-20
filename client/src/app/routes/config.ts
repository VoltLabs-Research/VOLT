import DashboardLayout from '@/modules/dashboard/components/organisms/DashboardLayout';
import { guestRoutes, protectedRoutes, publicRoutes } from '@/app/routes/definitions';
import type { RouteGroup } from '@/app/routes/types';

export const routesConfig: RouteGroup = {
    public: publicRoutes,
    protected: protectedRoutes,
    guest: guestRoutes,
    dashboardLayout: DashboardLayout
};
