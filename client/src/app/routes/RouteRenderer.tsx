/**
 * Copyright(c) 2025, Volt Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Route } from 'react-router-dom';
import ProtectedRoute from '@/features/auth/components/atoms/ProtectedRoute';
import DashboardLayout from '@/components/organisms/dashboard/DashboardLayout';
import SettingsLayout from '@/features/settings/components/organisms/SettingsLayout';
import PageTransition from '@/components/atoms/animations/PageTransition';
import { routesConfig } from '@/app/routes/config';
import type { RouteConfig } from '@/app/routes/types';

const wrapWithPageWrapper = (Component: React.ComponentType) => (
    <PageTransition>
        <Component />
    </PageTransition>
);

export const renderPublicRoutes = () => {
    return routesConfig.public.map((route: RouteConfig) => (
        <Route
            key={route.path}
            path={route.path}
            element={wrapWithPageWrapper(route.component)}
        />
    ));
};

export const renderProtectedRoutes = () => {
    const routesWithLayout = routesConfig.protected.filter(r => r.requiresLayout && !r.requiresSettingsLayout);
    const routesWithSettingsLayout = routesConfig.protected.filter(r => r.requiresSettingsLayout);
    const routesWithoutLayout = routesConfig.protected.filter(r => !r.requiresLayout);

    return (
        <Route element={<ProtectedRoute mode='protect' />}>
            {routesWithoutLayout.map((route: RouteConfig) => (
                <Route
                    key={route.path}
                    path={route.path}
                    element={wrapWithPageWrapper(route.component)}
                />
            ))}

            {routesWithLayout.length > 0 && (
                <Route element={<DashboardLayout />}>
                    {routesWithLayout.map((route: RouteConfig) => (
                        <Route
                            key={route.path}
                            path={route.path}
                            element={wrapWithPageWrapper(route.component)}
                        />
                    ))}

                    {routesWithSettingsLayout.length > 0 && (
                        <Route element={<SettingsLayout />}>
                            {routesWithSettingsLayout.map((route: RouteConfig) => (
                                <Route
                                    key={route.path}
                                    path={route.path}
                                    element={wrapWithPageWrapper(route.component)}
                                />
                            ))}
                        </Route>
                    )}
                </Route>
            )}
        </Route>
    );
};

export const renderGuestRoutes = () => {
    return (
        <Route element={<ProtectedRoute mode='guest' />}>
            {routesConfig.guest.map((route: RouteConfig) => (
                <Route
                    key={route.path}
                    path={route.path}
                    element={wrapWithPageWrapper(route.component)}
                />
            ))}
        </Route>
    );
};
