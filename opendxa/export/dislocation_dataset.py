import os
import json

class DislocationDataset:
    def __init__(self, directory='dislocations'):
        self.directory = directory
        self.timesteps_data = {}

    def load_all_timesteps(self):
        for filename in sorted(os.listdir(self.directory)):
            if filename.startswith('timestep_') and filename.endswith('.json'):
                t = int(filename.split('_')[1].split('.')[0])
                path = os.path.join(self.directory, filename)
                with open(path) as f:
                    data = json.load(f)
                    self.timesteps_data[t] = data['dislocations']

    def get_timesteps(self):
        return sorted(self.timesteps_data.keys())

    def get_dislocations(self, timestep):
        return self.timesteps_data.get(timestep, [])
