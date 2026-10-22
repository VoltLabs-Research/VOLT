// chartjs-node-canvas's ChartJSNodeCanvas, drawing with Chart.js on an OffscreenCanvas instead of
// node-canvas. The configuration is the one the daemon renders with node-canvas on a Node machine.
import { Chart, registerables } from 'chart.js';
import type { ChartConfiguration } from 'chart.js';

Chart.register(...registerables);

interface ChartJSNodeCanvasOptions {
    width: number;
    height: number;
    backgroundColour?: string;
}

const MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export class ChartJSNodeCanvas {
    private readonly options: ChartJSNodeCanvasOptions;

    constructor(options: ChartJSNodeCanvasOptions){
        this.options = options;
    }

    async renderToBuffer(configuration: ChartConfiguration, mimeType = 'image/png'): Promise<Buffer> {
        if(!MIME_TYPES.has(mimeType)){
            throw new Error(`chartjs-node-canvas: unsupported mime type ${mimeType}`);
        }
        const { width, height, backgroundColour } = this.options;
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext('2d');
        if(!context){
            throw new Error('chartjs-node-canvas: 2D canvas is unavailable');
        }
        const chart = new Chart(context as unknown as CanvasRenderingContext2D, {
            ...configuration,
            options: { ...configuration.options, animation: false, responsive: false },
            plugins: [
                ...(configuration.plugins ?? []),
                {
                    id: 'volt-background',
                    beforeDraw: (instance) => {
                        if(!backgroundColour){
                            return;
                        }
                        instance.ctx.save();
                        instance.ctx.fillStyle = backgroundColour;
                        instance.ctx.fillRect(0, 0, instance.width, instance.height);
                        instance.ctx.restore();
                    }
                }
            ]
        });
        chart.draw();
        const blob = await canvas.convertToBlob({ type: mimeType });
        chart.destroy();
        return Buffer.from(await blob.arrayBuffer());
    }
}

export default { ChartJSNodeCanvas };
