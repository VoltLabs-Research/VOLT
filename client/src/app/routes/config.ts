import DashboardLayout from '@/modules/dashboard/components/DashboardLayout';
import { guestRoutes, optionalAuthRoutes, protectedRoutes, publicRoutes } from '@/app/routes/definitions';
import type { RouteGroup } from '@/app/routes/types';

export const routesConfig: RouteGroup = {
    public: publicRoutes,
    protected: protectedRoutes,
    guest: guestRoutes,
    optionalAuth: optionalAuthRoutes,
    dashboardLayout: DashboardLayout
};
