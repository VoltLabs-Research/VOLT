import numpy as np

class DislocationLineage:
    '''
    Class to act as a data structure and store the biography (life history) of a single dislocation line.
    '''
    def __init__(self, lineage_id: str, frame_created: int, initial_data: dict):
        '''
        Initializes a new dislocation lineage.

        Args:
            lineage_id (str): Unique identifier for the lineage (e.g., "D-0001").
            frame_created (int): The frame in which the dislocation was first detected.
            initial_data (dict): The dictionary of initial data for the dislocation.
        '''
        self.id = lineage_id
        self.is_active = True
        self.creation_frame = frame_created

        self.history = [{
            'frame': frame_created,
            'status': 'NUCLEATED',
            **initial_data
        }]

    def update(self, frame: int, status: str, data: dict):
        '''
        Updates the lineage with a new event, typically 'TRACKED'.

        Args:
            frame (int): The frame of the new event.
            status (str): The status of the event (e.g., 'TRACKED').
            data (dict): The dislocation data for this new event.
        '''
        self.history.append({
            'frame': frame,
            'status': status,
            **data
        })

    def terminate(self, frame: int, status: str, data: dict = None):
        '''
        Adds the final event to the lineage and marks it as inactive.

        Args:
            frame (int): The frame where the lineage ends.
            status (str): The reason for the termination (e.g., 'ANNIHILATED', 'SPLIT').
            data (dict, optional): Data from the final event. If None, the data from the last event is used.
        '''
        final_data = data if data is not None else self.get_last_data()
        self.history.append({
            'frame': frame,
            'status': status,
            **final_data
        })
        self.is_active = False

    def get_last_data(self) -> dict:
        '''
        Gets the last known data of the dislocation (not including 'frame' and 'status').
        '''
        last_event = self.history[-1]
        return {
            key: value 
            for key, value in last_event.items()
            if key not in ['frame', 'status']
        }

    def get_lifetime(self) -> int:
        '''
        Calculates the length of the lineage in number of frames.
        '''
        if not self.history:
            return 0
        self.history[-1]['frame'] - self.history[0]['frame']

    def get_average_length(self) -> float:
        '''
        Calculate the average length of the dislocation over its lifetime.
        '''
        lengths = [
            event['length']
            for event in self.history
            if 'length' in event
        ]

        return np.mean(lengths) if lengths else 0

    def __repr__(self) -> str:
        '''
        String representation of the Lineage object.
        '''
        start = self.history[0]['frame']
        end = self.history[-1]['frame']
        status = self.history[-1]['status']
        return f'Lineage {self.id} (Frames: {start}-{end}, Status: {status})'