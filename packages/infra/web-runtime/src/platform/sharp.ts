// The part of sharp the server uses (resize with fit inside/cover, then encode to PNG or WebP), drawn
// with OffscreenCanvas. Encoders are the browser's, so files differ byte-wise from libvips' output.
type Fit = 'inside' | 'cover' | 'contain' | 'fill' | 'outside';

interface ResizeOptions {
    fit?: Fit;
    withoutEnlargement?: boolean;
}

interface EncodeOptions {
    quality?: number;
    compressionLevel?: number;
}

const scaleFor = (source: { width: number; height: number }, width: number, height: number, options: ResizeOptions): { width: number; height: number; cropX: number; cropY: number; cropWidth: number; cropHeight: number } => {
    const fit = options.fit ?? 'cover';
    const scaleX = width / source.width;
    const scaleY = height / source.height;
    let scale = fit === 'cover' || fit === 'outside' ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
    if(options.withoutEnlargement){
        scale = Math.min(scale, 1);
    }
    if(fit === 'fill'){
        return { width, height, cropX: 0, cropY: 0, cropWidth: source.width, cropHeight: source.height };
    }
    const scaledWidth = Math.round(source.width * scale);
    const scaledHeight = Math.round(source.height * scale);
    if(fit !== 'cover'){
        return { width: scaledWidth, height: scaledHeight, cropX: 0, cropY: 0, cropWidth: source.width, cropHeight: source.height };
    }
    // cover keeps the requested box and crops the centre of the scaled image to it.
    const outputWidth = Math.min(width, scaledWidth);
    const outputHeight = Math.min(height, scaledHeight);
    const cropWidth = outputWidth / scale;
    const cropHeight = outputHeight / scale;
    return {
        width: outputWidth,
        height: outputHeight,
        cropX: (source.width - cropWidth) / 2,
        cropY: (source.height - cropHeight) / 2,
        cropWidth,
        cropHeight
    };
};

class Pipeline {
    private readonly input: Blob;
    private resizeTo: { width: number; height: number; options: ResizeOptions } | null = null;
    private format: { type: string; quality?: number } = { type: 'image/png' };

    constructor(input: Uint8Array){
        this.input = new Blob([new Uint8Array(input)]);
    }

    resize(width: number, height: number, options: ResizeOptions = {}): this {
        this.resizeTo = { width, height, options };
        return this;
    }

    png(_options: EncodeOptions = {}): this {
        this.format = { type: 'image/png' };
        return this;
    }

    webp(options: EncodeOptions = {}): this {
        this.format = { type: 'image/webp', quality: (options.quality ?? 80) / 100 };
        return this;
    }

    jpeg(options: EncodeOptions = {}): this {
        this.format = { type: 'image/jpeg', quality: (options.quality ?? 80) / 100 };
        return this;
    }

    async metadata(): Promise<{ width: number; height: number; format: string }> {
        const bitmap = await createImageBitmap(this.input);
        const metadata = { width: bitmap.width, height: bitmap.height, format: this.format.type.split('/')[1] };
        bitmap.close();
        return metadata;
    }

    async toBuffer(): Promise<Buffer> {
        const bitmap = await createImageBitmap(this.input);
        const target = this.resizeTo
            ? scaleFor(bitmap, this.resizeTo.width, this.resizeTo.height, this.resizeTo.options)
            : { width: bitmap.width, height: bitmap.height, cropX: 0, cropY: 0, cropWidth: bitmap.width, cropHeight: bitmap.height };
        const canvas = new OffscreenCanvas(target.width, target.height);
        const context = canvas.getContext('2d');
        if(!context){
            throw new Error('sharp: 2D canvas is unavailable');
        }
        context.drawImage(bitmap, target.cropX, target.cropY, target.cropWidth, target.cropHeight, 0, 0, target.width, target.height);
        bitmap.close();
        const blob = await canvas.convertToBlob({ type: this.format.type, quality: this.format.quality });
        return Buffer.from(await blob.arrayBuffer());
    }
}

const sharp = (input: Uint8Array): Pipeline => new Pipeline(input);

export default sharp;
