import opendxa from '../../bindings/nodejs/index.mjs';
import type { 
    ConfigParameters,
    TrajectoryCallback
} from '../../bindings/nodejs/types/index.d.ts';

class OpenDXAService{
    constructor(){
        // The user could have configuration profiles in the database.
        // Here, they could be retrieved and loaded. However, OpenDXA from C++ already sets the default configuration.
    }

    configure(config: ConfigParameters){
        if(config.crystalStructure){
            opendxa.setCrystalStructure(config.crystalStructure);
        }

        if(config.maxTrialCircuitSize){
            opendxa.setMaxTrialCircuitSize(config.maxTrialCircuitSize);
        }

        if(config.circuitStretchability){
            opendxa.setCircuitStretchability(config.circuitStretchability);
        }

        if(config.onlyPerfectDislocations){
            opendxa.setOnlyPerfectDislocations(config.onlyPerfectDislocations);
        }

        if(config.markCoreAtoms){
            opendxa.setMarkCoreAtoms(config.markCoreAtoms);
        }

        if(config.lineSmoothingLevel){
            opendxa.setLineSmoothingLevel(config.lineSmoothingLevel);
        }

        if(config.linePointInterval){
            opendxa.setLinePointInterval(config.linePointInterval);
        }

        if(config.identificationMode){
            opendxa.setIdentificationMode(config.identificationMode);
        }
    }

    async analyzeTrajectory(inputFiles: string[], outputTemplate: string){
        return new Promise((resolve, reject) => {
            const trajectoryCallback: TrajectoryCallback = (error, result) => {
                if(error){
                    console.error('Trajectory analysis failed:', error);
                    reject(error);

                    return;
                }

                resolve(result);
            };

            opendxa.computeTrajectory(inputFiles, outputTemplate, trajectoryCallback);
        });
    }
};

export default OpenDXAService;