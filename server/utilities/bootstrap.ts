import logger from '@/logger';

export const configureApp = async({ app, routes, suffix, middlewares, errorHandler }: any): Promise<void> =>{
    middlewares.forEach((middlewares: any) => app.use(middlewares));
    try{
        const routePromises = routes.map(async(route: string) => {
            try{
                const module = route.replace(/\//g, '-').split(/(?=[A-Z])/).join('-').toLowerCase();
                const routerModule = require(`@routes/${route}`);
                const router = routerModule.default;
                if(router){
                    const routePath = suffix + module;
                    app.use(routePath, router);
                }else{
                    logger.error(`The module imported from '@routes/${route}' does not have a default export.`);
                }
            }catch(importError){
                logger.error(`Failed to import route '${route}'. Error: ${importError}`);
            }
        });
        await Promise.all(routePromises);

        // Register global error handler AFTER all routes
        if(errorHandler){
            app.use(errorHandler);
        }
    }catch(error){
        logger.error(`Error setting up the application routes ${error}`);
    }
};
