import { NativeExporter } from '@modules/trajectory/domain/port/trajectory/exporters/INativeExporter';

import path from 'node:path';

const nativePath = path.join(process.cwd(), 'native/build/Release/glb_exporter.node');
const nativeExporter: NativeExporter = require(nativePath);
export default nativeExporter;
