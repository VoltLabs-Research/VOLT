/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
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

import logger from '@/logger';

export const configureApp = async ({ app, routes, suffix, middlewares, errorHandler }: any): Promise<void> => {
    middlewares.forEach((middlewares: any) => app.use(middlewares));
    try {
        const routePromises = routes.map(async (route: string) => {
            try {
                const routePath = suffix + route.replace(/\//g, '-').split(/(?=[A-Z])/).join('-').toLowerCase();
                const routerModule = require(`@routes/${route}`);
                const router = routerModule.default;
                if (router) {
                    app.use(routePath, router);
                } else {
                    logger.error(`The module imported from '@routes/${route}' does not have a default export.`);
                }
            } catch (importError) {
                logger.error(`Failed to import route '${route}'. Error: ${importError}`);
            }
        });
        await Promise.all(routePromises);

        // Register global error handler AFTER all routes
        if (errorHandler) {
            app.use(errorHandler);
        }
    } catch (error) {
        logger.error(`Error setting up the application routes ${error}`);
    }
};
