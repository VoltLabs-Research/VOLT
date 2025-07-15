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
  console.log(`Progress: ${progress.completedFrames}/${progress.totalFrames}`);
};

const trajectoryCallback: TrajectoryCallback = (error: Error | null, result?: TrajectoryResult) => {
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  console.log(result);
};

opendxa.setProgressCallback(progressCallback);
opendxa.computeTrajectory(files, 'output_{}.json', trajectoryCallback);