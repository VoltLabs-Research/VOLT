import path from 'node:path';
import { NativeExporter } from '@modules/trajectory/domain/port/exporters/INativeExporter';

const nativePath = path.join(process.cwd(), 'native/build/Release/glb_exporter.node');
const nativeExporter: NativeExporter = require(nativePath);
export default nativeExporter;
