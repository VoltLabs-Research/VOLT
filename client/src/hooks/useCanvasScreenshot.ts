import { useCallback } from 'react';
import { useThree } from '@react-three/fiber';

interface ScreenshotOptions {
    width?: number;
    height?: number;
    format?: 'png' | 'jpeg' | 'webp';
    quality?: number;
    fileName?: string;
    download?: boolean;
}

const useCanvasScreenshot = () => {
    const { gl, scene, camera } = useThree();

    const captureScreenshot = useCallback((options: ScreenshotOptions = {}) => {
        const {
            width,
            height,
            format = 'png',
            quality = 1.0,
            fileName = `canvas-screenshot-${Date.now()}`,
            download = true
        } = options;

        return new Promise<string>((resolve, reject) => {
            try{
                gl.render(scene, camera);
                const canvas = gl.domElement;
                
                // If different dimensions are specified, create a temporary canvas
                if(width && height && (width !== canvas.width || height !== canvas.height)){
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = width;
                    tempCanvas.height = height;
                    
                    const tempCtx = tempCanvas.getContext('2d');
                    if(!tempCtx){
                        reject(new Error('No se pudo obtener el contexto 2D del canvas temporal'));
                        return;
                    }
                    
                    tempCtx.drawImage(canvas, 0, 0, width, height);
                    
                    const mimeType = `image/${format}`;
                    const dataURL = tempCanvas.toDataURL(mimeType, quality);
                    
                    if(download){
                        downloadImage(dataURL, `${fileName}.${format}`);
                    }
                    
                    resolve(dataURL);
                }else{
                    // TODO: Duplicated Code!
                    const mimeType = `image/${format}`;
                    const dataURL = canvas.toDataURL(mimeType, quality);
                    
                    if(download){
                        downloadImage(dataURL, `${fileName}.${format}`);
                    }
                    
                    resolve(dataURL);
                }
            }catch(error){
                reject(error);
            }
        });
    }, [gl, scene, camera]);

    return captureScreenshot;
};

const downloadImage = (dataURL: string, fileName: string) => {
    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export default useCanvasScreenshot;