from opendxa.digrat.dislocation_lineage import DislocationLineage
from scipy.optimize import linear_sum_assignment
from opendxa import DislocationAnalysis
from collections import defaultdict
from itertools import combinations
from typing import Dict
import numpy as np
import json

class DislocationTracker:
    '''
    Tracks the lifecycle of dislocations across multiple frames of a simulation, identifying simple and complex events.
    '''
    def __init__(self):
        '''
        Initialize the tracker.
        '''
        self.dislocation_lineage: Dict[str, DislocationLineage] = {}
        self.frame_fingerprints: Dict[int, dict] = {}
        self.frame_to_lineage: Dict[int, dict] = {}
        self.next_lineage_id: int = 0
        self.tracking_log: list = []
        self.tracking_stats: Dict[str, any] = defaultdict(int)
        self.tracking_stats['tracking_errors'] = []

    def get_new_lineage_id(self) -> str:
        '''
        Generates a new, unique, sequential lineage ID.
        '''
        next_id = f'D-{self.next_lineage_id:04d}'
        self.next_lineage_id += 1
        return next_id
    
    def create_dislocation_fingerprint(self, dislocation_data: dict) -> dict:
        '''
        Creates a 'fingerprint' with pre-processed values for efficient dislocation comparison.
        '''
        burgers_vector = np.array(dislocation_data['burgers_vector'])
        burgers_magnitude = np.linalg.norm(burgers_vector)
        return {
            'burgers_vector': burgers_vector,
            'position': np.array(dislocation_data['position']),
            'length': float(dislocation_data['length']),
            'burgers_magnitude': burgers_magnitude,
            'burgers_normalized': burgers_vector / max(burgers_magnitude, 1e-10)
        }
    
    def calculate_similarity_score(
        self, 
        fp1: dict, 
        fp2: dict, 
        spatial_weight: 
        float = 0.4, 
        burgers_weight: float = 0.4, 
        length_weight: float = 0.2, 
        max_spatial_dist: float = 15.0
    ) -> float:
        '''
        Calculates a similarity score between two dislocations.
        The score is a weighted sum of similarities in position, Burgers vector, and length.
        '''
        # Normalized spatial distance
        spatial_dist = np.linalg.norm(fp1['position'] - fp2['position'])
        if spatial_dist > max_spatial_dist:
            # Immediate disqualification if they are too far away
            return 0.0
        
        spatial_score = 1.0 - (spatial_dist / max_spatial_dist)

        # Burgers vector similarity (direction and magnitude)
        burgers_dot = np.dot(fp1['burgers_normalized'], fp2['burgers_normalized'])
        burgers_dir_score = max(0, burgers_dot)
        magnitude_ratio = min(
            fp1['burgers_magnitude'],
            fp2['burgers_magnitude']
        ) / max(fp1['burgers_magnitude'], fp2['burgers_magnitude'], 1e-10)
        burgers_score = burgers_dir_score * magnitude_ratio

        # Similarity of length
        length_ratio = min(fp1['length'], fp2['length']) / max(fp1['length'], fp2['length'], 1e-10)

        # Weighted Combined Score
        total_score = (
            spatial_weight * spatial_score +
            burgers_weight * burgers_score +
            length_weight * length_ratio
        )

        return max(0, min(1, total_score))
    
    def load_frame_data(self, dump_path: str, frame_index: int) -> dict:
        pipeline = DislocationAnalysis()
        
    def matching_algorithm(self, prev_fps: dict, curr_fps: dict, min_similarity: float = 0.6) -> list:
        '''
        Solve the 1-to-1 matching problem using the Hungarian Algorithm to find the globally optimal match.
        '''
        if not prev_fps or not curr_fps:
            return []

        prev_ids = list(prev_fps.keys())
        curr_ids = list(curr_fps.keys())

        # Build the similarity matrix (and cost for the algorithm)
        similarity_matrix = np.zeros((len(prev_ids), len(curr_ids)))
        for i, prev_id in enumerate(prev_ids):
            for j, curr_id in enumerate(curr_ids):
                score = self.calculate_similarity_score(prev_fps[prev_id], curr_fps[curr_id])
                similarity_matrix[i, j] = score
        
        # The Hungarian algorithm minimizes costs, so we use 1 - similarity
        cost_matrix = 1 - similarity_matrix

        # Solve the linear assignment problem
        row_indices, col_indices = linear_sum_assignment(cost_matrix)

        matches = []
        for i, j in zip(row_indices, col_indices):
            # Only accept matches that exceed the similarity threshold
            if similarity_matrix[i, j] >= min_similarity:
                matches.append((prev_ids[i], curr_ids[j], similarity_matrix[i, j]))
        return matches
    
    def detect_complex_events(
        self,
        prev_fps: dict,
        curr_fps: dict,
        unmatched_prev: set,
        unmatched_curr: set,
        burgers_tolerance: float = 0.05
    ) -> tuple:
        '''
        Detects complex events (mergers and splits) between unpaired dislocations, based on Burgers vector conservation.
        '''
        merges = []
        splits = []

        # Convert lists to use combinations
        unmatched_prev_list = list(unmatched_prev)
        unmatched_curr_list = list(unmatched_curr)

        # Merge Detection (Multiple Parents -> 1 Child)
        for child_id in unmatched_curr_list:
            child_fp = curr_fps[child_id]
            # Consider combinations of 2 or 3 parents
            for r in range(2, min(len(unmatched_prev_list) + 1, 4)):
                for parent_ids_tuple in combinations(unmatched_prev_list, r):
                    parent_ids = list(parent_ids_tuple)
                    burgers_sum = sum(prev_fps[pid]['burgers_vector'] for pid in parent_ids)
                    if np.linalg.norm(burgers_sum - child_fp['burgers_vector']) < burgers_tolerance:
                        merges.append((parent_ids, child_id))
                        # We found a merge for this child
                        break
                if any(m[1] == child_id for m in merges):
                    break
        
        # Split Detection (1 Parent -> Multiple Children)
        for parent_id in unmatched_prev_list:
            parent_fp = prev_fps[parent_id]
            # Consider combinations of 2 or 3 children
            for r in range(2, min(len(unmatched_curr_list) + 1, 4)):
                for child_ids_tuple in combinations(unmatched_curr_list, r):
                    child_ids = list(child_ids_tuple)
                    burgers_sum = sum(curr_fps[cid]['burgers_vector'] for cid in child_ids)
                    if np.linalg.norm(burgers_sum - parent_fp['burgers_vector']) < burgers_tolerance:
                        splits.append((parent_id, child_ids))
                        # We found a split for this father
                        break
                if any(s[0] == parent_id for s in splits):
                    break
        return merges, splits
    
    def process_events_and_update_lineage(
        self,
        prev_frame_idx: int,
        curr_frame_idx: int,
        prev_data: dict,
        curr_data: dict,
        min_similarity: float,
        burgers_tolerance: float
    ):
        '''
        Orchestrates event determination following a discard hierarchy and updates lineages.
        '''
        # Initial frame
        if not prev_data:
            self.frame_to_lineage[curr_frame_idx] = {}
            for curr_id, data in curr_data.items():
                lineage_id = self.get_new_lineage_id()
                self.dislocation_lineage[lineage_id] = DislocationLineage(lineage_id, curr_frame_idx, data)
                self.frame_to_lineage[curr_frame_idx][curr_id] = lineage_id
                self.tracking_stats['total_nucleations'] += 1
            return
        
        # Matching 1 - 1 (TRACKED)
        prev_fps = self.frame_fingerprints[prev_frame_idx]
        curr_fps = self.frame_fingerprints[curr_frame_idx]
        matches = self.matching_algorithm(prev_fps, curr_fps, min_similarity)
        
        self.frame_to_lineage[curr_frame_idx] = {}
        matched_prev = set()
        matched_curr = set()

        for prev_id, curr_id, score in matches:
            lineage_id = self.frame_to_lineage[prev_frame_idx][prev_id]
            self.dislocation_lineage[lineage_id].update(curr_frame_idx, 'TRACKED', curr_data[curr_id])
            self.frame_to_lineage[curr_frame_idx][curr_id] = lineage_id
            self.tracking_stats['total_tracks'] += 1
            matched_prev.add(prev_id)
            matched_curr.add(curr_id)

        unmatched_prev = set(prev_data.keys()) - matched_prev
        unmatched_curr = set(curr_data.keys()) - matched_curr

        # Complex Event Detection (SPLIT/MERGE)
        merges, splits = self.detect_complex_events(prev_fps, curr_fps, unmatched_prev, unmatched_curr, burgers_tolerance)
        for parent_ids, child_id in merges:
            if all(pid in unmatched_prev for pid in parent_ids) and child_id in unmatched_curr:
                parent_lineage_ids = []
                for pid in parent_ids:
                    lineage_id = self.frame_to_lineage[prev_frame_idx][pid]
                    self.dislocation_lineage[lineage_id].terminate(curr_frame_idx, f'MERGED_INTO_{child_id}')
                    parent_lineage_ids.append(lineage_id)
                new_lineage_id = self.get_new_lineage_id()
                self.dislocation_lineage[new_lineage_id] = DislocationLineage(new_lineage_id, curr_frame_idx, curr_data[child_id])
                self.dislocation_lineage[new_lineage_id].history[0]['status'] = f'MERGE_PRODUCT_OF_{"+".join(parent_lineage_ids)}'
                self.frame_to_lineage[curr_frame_idx][child_id] = new_lineage_id
                unmatched_curr.discard(child_id)
                for pid in parent_ids:
                    unmatched_prev.discard(pid)
                self.tracking_stats['total_merges'] += 1
        
        for parent_id, child_ids in splits:
            for parent_id in unmatched_prev and all(cid in unmatched_curr for cid in child_ids):
                parent_lineage_id = self.frame_to_lineage[prev_frame_idx][parent_id]
                self.dislocation_lineage[parent_lineage_id].terminate(curr_frame_idx, 'SPLIT')

                for cid in child_ids:
                    new_lineage_id = self.get_new_lineage_id()
                    self.dislocation_lineage[new_lineage_id] = DislocationLineage(new_lineage_id, curr_frame_idx, curr_data[cid])
                    self.dislocation_lineage[new_lineage_id].history[0]['status'] = f'SPLIT_PRODUCT_OF_{parent_lineage_id}'
                    self.frame_to_lineage[curr_frame_idx][cid] = new_lineage_id
                
                unmatched_prev.discard(parent_id)
                for cid in child_ids:
                    unmatched_curr.discard(cid)
                self.tracking_stats['total_splits'] += 1
        
        # Leftovers from the previous frame (ANNIHILATED)
        for prev_id in unmatched_prev:
            lineage_id = self.frame_to_lineage[prev_frame_idx][prev_id]
            if self.dislocation_lineage[lineage_id].is_active:
                self.dislocation_lineage[lineage_id].terminate(curr_frame_idx, 'ANNIHILATED')
                self.tracking_stats['total_annihilations'] += 1
        
        # Leftovers from the current frame (NUCLEATED
        for curr_id in unmatched_curr:
            lineage_id = self.get_new_lineage_id()
            self.dislocation_lineage[lineage_id] = DislocationLineage(lineage_id, curr_frame_idx, curr_data[curr_id])
            self.frame_to_lineage[curr_frame_idx][curr_id] = lineage_id
            self.tracking_stats['total_nucleations'] += 1
    
    def analyze_trajectory(
        self,
        dump_folder: str,
        start_frame: int,
        end_frame: int,
        step: int = 1,
        min_similarity: float = 0.7,
        burgers_tolerance: float = 0.05
    ):
        '''
        Analyzes a complete trajectory, managing the loop through frames and calling processing logic.
        '''
        pass

    def export_lineage_data(self, export_file: str):
        export_data = { 'lineages': {} }
        for lineage_id, lineage in self.dislocation_lineage.items():
            history_serializable = []
            for event in lineage.history:
                serializable_event = {}
                for key, value in event.items():
                    serializable_event[key] = value.tolist() if isinstance(value, np.ndarray) else value
                history_serializable.append(serializable_event)
            
            export_data['lineages'][lineage_id] = {
                'id': lineage.id,
                'history': history_serializable,
                'is_active': lineage.is_active,
                'creation_frame': lineage.creation_frame,
                'lifetime': lineage.get_lifetime(),
                'average_length': lineage.get_average_length()
            }
        
        with open(export_file, 'w', encoding='utf-8') as file:
            json.dump(export_data, file, ident=2)