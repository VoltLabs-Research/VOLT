import authService from '@/modules/auth/api/service';
import systemService from '@/modules/system/api/service';

export const tryLocalAutoLogin = async (): Promise<string | null> => {
    try{
        const { mode } = await systemService.getDeploymentConfig({});
        if(mode !== 'local'){
            return null;
        }
        const { token } = await authService.localSignIn({});
        return token;
    }catch{
        return null;
    }
};
