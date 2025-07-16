import * as fs from 'fs';
import * as path from 'path';  
import opendxa from '../../bindings/nodejs/index.mjs';
import type { 
    ProgressCallback, 
    ProgressInfo, 
    TrajectoryCallback,
    TrajectoryResult 
} from '../../bindings/nodejs/types/index.d.ts';

opendxa.setCrystalStructure(opendxa.LatticeStructure.FCC);
opendxa.setMaxTrialCircuitSize(14.0);

const dir = '/home/rodyherrera/OpenDXA/debug-data/Simulations/Sigma9yz/';
const files: string[] = fs.readdirSync(dir)
  .slice(0, 4)
  .map((filename: string) => path.join(dir, filename));

const progressCallback: ProgressCallback = (progress: ProgressInfo) => {
  console.log('PROGRESS CALLBACK');
  console.log(`Progress: ${progress.completedFrames}/${progress.totalFrames} (${progress.progressPercent?.toFixed(1) || 0}%)`);
};

// ✅ FIX: Añadir el callback de trayectoria
const trajectoryCallback: TrajectoryCallback = (error: Error | null, result?: TrajectoryResult) => {
  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } else {
    console.log('TRAJECTORY COMPLETED!');
    console.log('Total frames processed:', result?.frames?.length || 0);
    console.log('Analysis failed:', result?.is_failed || false);
    console.log('Total time:', result?.total_time || 0, 'seconds');
  }
};

opendxa.setProgressCallback(progressCallback);

// ✅ FIX: Usar modo asíncrono con callback
opendxa.computeTrajectory(files, 'output_{}.json', trajectoryCallback);

console.log('Analysis started...');