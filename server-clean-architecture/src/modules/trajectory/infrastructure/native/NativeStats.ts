import path from 'path';
import { NativeStats } from '../../domain/port/exporters/INativeStats';

// Ensure we point to the correct location of the native module
const nativePath = path.join(process.cwd(), 'native/build/Release/stats_parser.node');
const nativeModule: NativeStats = require(nativePath);

export default nativeModule;