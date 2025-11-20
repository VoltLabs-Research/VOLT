interface DislocationBurger{
    vector: [number, number, number];
    magnitude: number;
    fractional: string;
};

interface DislocationNodes{
    forward: any;
    backward: any;
}

interface LineDirection{
    vector: [number, number, number];
    string: string;
};

export interface DislocationSegment{
    index: number;
    type: string;
    point_index_offset: number;
    num_points: number;
    length: number;
    points: [number, number, number][];
    burgers: DislocationBurger;
    junction_info: {
        forward_node_dangling: boolean;
        backward_node_dangling: boolean;
        junction_arms_count: number;
        forms_junction: boolean;
    };
    core_sizes: number[];
    average_core_size: number;
    is_closed_loop: boolean;
    is_infinite_line: boolean;
    segment_id: number;
    line_direction: LineDirection;
    nodes: DislocationNodes;
};

export interface DislocationSummary{
    segmentId: number;
    type: string;
    numPoints: number;
    length: number;
    points: [number, number, number][];
    burgers: DislocationBurger;
    nodes: DislocationNodes;
    lineDirection: LineDirection;
}