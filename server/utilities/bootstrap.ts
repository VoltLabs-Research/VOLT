export const configureApp = async ({ app, routes, suffix, middlewares }: any): Promise<void> => {
    middlewares.forEach((middlewares: any) => app.use(middlewares));
    try{
        const routePromises = routes.map(async (route: string) => {
            try{
                const routePath = suffix + route.replace(/\//g, '-').split(/(?=[A-Z])/).join('-').toLowerCase();
                const routerModule = require(`@routes/${route}`);
                const router = routerModule.default;
                if(router){
                    app.use(routePath, router);
                }else{
                    console.error(`The module imported from '@routes/${route}' does not have a default export.`);
                }
            }catch(importError){
                console.error(`Failed to import route '${route}'. Error: ${importError}`);
            }
        });
        await Promise.all(routePromises);
    }catch(error){
        console.error('Error setting up the application routes ' + error);
    }
};
