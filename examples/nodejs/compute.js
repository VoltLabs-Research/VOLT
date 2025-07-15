const opendxa = require('../../bindings/nodejs/index.js');
const path = require('path');
const fs = require('fs');

const dir = '/home/rodyherrera/OpenDXA/debug-data/Simulations/Sigma9yz/';
const files = fs.readdirSync(dir)
    .map(filename => path.join(dir, filename));

opendxa.computeTrajectory(files, '/home/rodyherrera/OpenDXA/debug-data/nodejs/output_frame_{}.json', (error, result) => {
    if(error){
        console.error('Error:', error);
        return;
    }

    console.log(result);
});