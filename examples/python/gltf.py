import orjson
import json
import base64
import numpy as np

def export_interface_mesh_to_gltf(json_file_path: str, output_gltf_path: str):
    """
    Exporta la interface mesh del JSON de OpenDXA a formato glTF
    Maneja automáticamente meshes grandes (>65K vértices)
    
    Args:
        json_file_path: Ruta al archivo JSON con los datos
        output_gltf_path: Ruta donde guardar el archivo .gltf
    """
    # Cargar datos del JSON
    with open(json_file_path, 'rb') as f:
        data = orjson.loads(f.read())
    
    if 'interface_mesh' not in data:
        raise ValueError("No interface_mesh data found in JSON")
    
    mesh_data = data['interface_mesh']['data']
    
    # Extraer puntos
    points = []
    for point_data in mesh_data.get('points', []):
        pos = point_data.get('position', [0, 0, 0])
        points.append([float(pos[0]), float(pos[1]), float(pos[2])])
    
    if not points:
        raise ValueError("No points found in mesh data")
    
    # Extraer facetas (triángulos)
    facets = []
    for facet_data in mesh_data.get('facets', []):
        vertices = facet_data.get('vertices', [])
        if len(vertices) >= 3:
            # Asegurar que los índices sean válidos
            triangle = vertices[:3]
            if all(0 <= v < len(points) for v in triangle):
                facets.append(triangle)
    
    if not facets:
        raise ValueError("No valid facets found in mesh data")
    
    print(f"Processing mesh: {len(points)} vertices, {len(facets)} triangles")
    
    # Determinar tipo de índice basado en número de vértices
    if len(points) > 65535:
        index_dtype = np.uint32
        index_component_type = 5125  # UNSIGNED_INT
        print("Using 32-bit indices (large mesh)")
    else:
        index_dtype = np.uint16
        index_component_type = 5123  # UNSIGNED_SHORT
        print("Using 16-bit indices (small mesh)")
    
    # Convertir a numpy arrays
    vertices = np.array(points, dtype=np.float32)
    
    # Crear índices con el tipo correcto
    indices_list = [idx for triangle in facets for idx in triangle]
    indices = np.array(indices_list, dtype=index_dtype)
    
    # Calcular normales por vértice (promedio de normales de caras adyacentes)
    normals = np.zeros_like(vertices)
    
    print("Calculating vertex normals...")
    for i in range(0, len(indices), 3):
        # Obtener vértices del triángulo
        v0, v1, v2 = vertices[indices[i]], vertices[indices[i+1]], vertices[indices[i+2]]
        
        # Calcular normal de la cara
        edge1 = v1 - v0
        edge2 = v2 - v0
        face_normal = np.cross(edge1, edge2)
        
        # Normalizar
        norm = np.linalg.norm(face_normal)
        if norm > 0:
            face_normal = face_normal / norm
        
        # Agregar a las normales de los vértices
        normals[indices[i]] += face_normal
        normals[indices[i+1]] += face_normal
        normals[indices[i+2]] += face_normal
    
    # Normalizar las normales de vértice
    print("Normalizing vertex normals...")
    for i in range(len(normals)):
        norm = np.linalg.norm(normals[i])
        if norm > 0:
            normals[i] = normals[i] / norm
        else:
            normals[i] = [0, 1, 0]  # Normal por defecto
    
    # Crear buffers binarios
    print("Creating binary buffers...")
    vertex_buffer = vertices.tobytes()
    normal_buffer = normals.tobytes()
    index_buffer = indices.tobytes()
    
    # Combinar todos los buffers
    total_buffer = vertex_buffer + normal_buffer + index_buffer
    
    # Codificar en base64
    print("Encoding to base64...")
    buffer_base64 = base64.b64encode(total_buffer).decode('ascii')
    
    # Calcular bounding box
    min_bounds = vertices.min(axis=0).tolist()
    max_bounds = vertices.max(axis=0).tolist()
    
    # Crear estructura glTF
    print("Creating glTF structure...")
    gltf = {
        "asset": {
            "version": "2.0",
            "generator": "OpenDXA Interface Mesh Exporter"
        },
        "scene": 0,
        "scenes": [
            {
                "nodes": [0]
            }
        ],
        "nodes": [
            {
                "mesh": 0,
                "name": "InterfaceMesh"
            }
        ],
        "meshes": [
            {
                "primitives": [
                    {
                        "attributes": {
                            "POSITION": 0,
                            "NORMAL": 1
                        },
                        "indices": 2,
                        "material": 0
                    }
                ],
                "name": "InterfaceMeshGeometry"
            }
        ],
        "materials": [
            {
                "name": "InterfaceMeshMaterial",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.0, 0.8, 1.0, 0.8],  # Cyan semi-transparente
                    "metallicFactor": 0.1,
                    "roughnessFactor": 0.8
                },
                "alphaMode": "BLEND"
            }
        ],
        "accessors": [
            {
                "bufferView": 0,
                "componentType": 5126,  # FLOAT
                "count": len(vertices),
                "type": "VEC3",
                "min": min_bounds,
                "max": max_bounds
            },
            {
                "bufferView": 1,
                "componentType": 5126,  # FLOAT
                "count": len(normals),
                "type": "VEC3"
            },
            {
                "bufferView": 2,
                "componentType": index_component_type,  # UNSIGNED_SHORT o UNSIGNED_INT
                "count": len(indices),
                "type": "SCALAR"
            }
        ],
        "bufferViews": [
            {
                "buffer": 0,
                "byteOffset": 0,
                "byteLength": len(vertex_buffer),
                "target": 34962  # ARRAY_BUFFER
            },
            {
                "buffer": 0,
                "byteOffset": len(vertex_buffer),
                "byteLength": len(normal_buffer),
                "target": 34962  # ARRAY_BUFFER
            },
            {
                "buffer": 0,
                "byteOffset": len(vertex_buffer) + len(normal_buffer),
                "byteLength": len(index_buffer),
                "target": 34963  # ELEMENT_ARRAY_BUFFER
            }
        ],
        "buffers": [
            {
                "byteLength": len(total_buffer),
                "uri": f"data:application/octet-stream;base64,{buffer_base64}"
            }
        ]
    }
    
    print("Writing glTF file...")
    with open(output_gltf_path, 'w') as f:
        json.dump(gltf, f, indent=2)
    
    print(f"✅ Interface mesh exported to glTF: {output_gltf_path}")
    print(f"   Vertices: {len(vertices):,}")
    print(f"   Triangles: {len(facets):,}")
    print(f"   Index type: {index_dtype.__name__}")
    print(f"   File size: {len(total_buffer) / (1024*1024):.1f} MB")
import orjson
import numpy as np

def visualize_dislocations_and_mesh_vtk(json_file_path: str, line_width: float = 3.0, 
                                       tube_radius: float = None, show_points: bool = False,
                                       tube_resolution: int = 16, smooth_lines: bool = True,
                                       antialias: bool = True):
    """
    Visualiza dislocaciones e interface mesh con alternancia por tecla
    
    Controls:
        'm' - Alternar interface mesh
        'd' - Alternar dislocaciones
        'b' - Mostrar ambos
        'r' - Reset camera
        'q' - Quit
    """
    try:
        import vtk
    except ImportError:
        print("VTK no está instalado. Instalando...")
        import subprocess
        subprocess.check_call(["pip", "install", "vtk"])
        import vtk
    
    # Cargar datos del JSON
    with open(json_file_path, 'rb') as f:
        data = orjson.loads(f.read())
    
    # Verificar datos disponibles
    has_dislocations = 'dislocations' in data and 'data' in data['dislocations']
    has_mesh = 'interface_mesh' in data and 'data' in data['interface_mesh']
    
    if not has_dislocations and not has_mesh:
        raise ValueError("No dislocation or interface mesh data found")
    
    print(f"Available data: Dislocations={has_dislocations}, Interface Mesh={has_mesh}")
    
    # Crear renderer
    renderer = vtk.vtkRenderer()
    renderer.SetBackground(1.0, 1.0, 1.0)  # Fondo blanco
    
    # Activar anti-aliasing
    if antialias:
        renderer.SetUseFXAA(True)
        renderer.GetFXAAOptions().SetRelativeContrastThreshold(0.125)
        renderer.GetFXAAOptions().SetHardContrastThreshold(0.045)
        renderer.GetFXAAOptions().SetSubpixelBlendLimit(0.75)
        renderer.GetFXAAOptions().SetSubpixelContrastThreshold(0.25)
    
    # Estado de visualización
    class VisualizationState:
        def __init__(self):
            self.show_dislocations = True
            self.show_mesh = False
            self.dislocation_actors = []
            self.mesh_actors = []
    
    state = VisualizationState()
    
    # Crear actores de dislocaciones
    if has_dislocations:
        state.dislocation_actors = create_dislocation_actors(
            data, tube_radius, line_width, tube_resolution, smooth_lines, show_points
        )
        print(f"Created {len(state.dislocation_actors)} dislocation actors")
    
    # Crear actores de interface mesh
    if has_mesh:
        state.mesh_actors = create_mesh_actors(data)
        print(f"Created {len(state.mesh_actors)} mesh actors")
    
    # Función para actualizar visualización
    def update_visualization():
        # Remover todos los actores
        renderer.RemoveAllViewProps()
        
        # Agregar actores según estado
        if state.show_dislocations:
            for actor in state.dislocation_actors:
                renderer.AddActor(actor)
        
        if state.show_mesh:
            for actor in state.mesh_actors:
                renderer.AddActor(actor)
        
        # Agregar texto de estado
        status_text = []
        if state.show_dislocations and state.show_mesh:
            status_text.append("Showing: Dislocations + Interface Mesh")
        elif state.show_dislocations:
            status_text.append("Showing: Dislocations Only")
        elif state.show_mesh:
            status_text.append("Showing: Interface Mesh Only")
        else:
            status_text.append("Nothing visible")
        
        status_text.append("Controls: 'm'=Mesh, 'd'=Dislocations, 'b'=Both, 'r'=Reset")
        
        text_actor = vtk.vtkTextActor()
        text_actor.SetInput("\n".join(status_text))
        text_actor.GetTextProperty().SetFontSize(12)
        text_actor.GetTextProperty().SetColor(0, 0, 0)  # Texto negro
        text_actor.SetPosition(10, 10)
        renderer.AddActor2D(text_actor)
        
        render_window.Render()
    
    # Crear ventana
    render_window = vtk.vtkRenderWindow()
    render_window.AddRenderer(renderer)
    render_window.SetSize(1920, 1080)
    render_window.SetMultiSamples(8)
    render_window.SetWindowName("Dislocations & Interface Mesh Viewer")
    
    # Crear interactor
    interactor = vtk.vtkRenderWindowInteractor()
    interactor.SetRenderWindow(render_window)
    
    # Clase para manejar eventos de teclado
    class KeyPressInteractorStyle(vtk.vtkInteractorStyleTrackballCamera):
        def __init__(self, parent=None):
            self.parent = renderer
            self.AddObserver("KeyPressEvent", self.key_press_event)
        
        def key_press_event(self, obj, event):
            key = interactor.GetKeySym().lower()
            
            if key == 'm':  # Toggle mesh
                if has_mesh:
                    state.show_mesh = not state.show_mesh
                    print(f"Interface mesh: {'ON' if state.show_mesh else 'OFF'}")
                    update_visualization()
                else:
                    print("No interface mesh data available")
            
            elif key == 'd':  # Toggle dislocations
                if has_dislocations:
                    state.show_dislocations = not state.show_dislocations
                    print(f"Dislocations: {'ON' if state.show_dislocations else 'OFF'}")
                    update_visualization()
                else:
                    print("No dislocation data available")
            
            elif key == 'b':  # Show both
                if has_dislocations:
                    state.show_dislocations = True
                if has_mesh:
                    state.show_mesh = True
                print("Showing both dislocations and mesh")
                update_visualization()
            
            elif key == 'h':  # Help
                print("\nControls:")
                print("  'm' - Toggle interface mesh")
                print("  'd' - Toggle dislocations")
                print("  'b' - Show both")
                print("  'r' - Reset camera")
                print("  'h' - Show this help")
                print("  'q' - Quit")
            
            elif key == 's':  # Screenshot
                save_screenshot(render_window)
            
            # Llamar al método padre para otros controles
            return
    
    # Asignar estilo de interacción
    style = KeyPressInteractorStyle()
    interactor.SetInteractorStyle(style)
    
    # Mostrar visualización inicial
    update_visualization()
    renderer.ResetCamera()
    
    print(f"\nVisualization ready!")
    print(f"Available data: Dislocations={has_dislocations}, Interface Mesh={has_mesh}")
    print("\nControls:")
    print("- 'm': Toggle interface mesh")
    print("- 'd': Toggle dislocations") 
    print("- 'b': Show both")
    print("- 'r': Reset camera")
    print("- 's': Take screenshot")
    print("- 'h': Show help")
    print("- 'q': Quit")
    print("- Mouse: Rotate/Zoom/Pan")
    
    # Iniciar interacción
    render_window.Render()
    interactor.Start()


def create_dislocation_actors(data, tube_radius, line_width, tube_resolution, smooth_lines, show_points):
    """Crea actores para las dislocaciones"""
    import vtk
    
    dislocation_data = data['dislocations']['data']
    
    # Colores de Ovito
    type_colors = {
        'Other': [0.8, 0.2, 0.2],
        '1/2<111>': [0.2, 0.8, 0.2],
        '<100>': [0.8, 0.2, 0.8],
        '<110>': [0.2, 0.4, 1.0],
        'screw': [1.0, 0.0, 0.0],
        'edge': [0.0, 1.0, 0.0],
        'mixed': [0.0, 0.0, 1.0],
        'unknown': [0.5, 0.5, 0.5]
    }
    
    # Clasificar segmentos (misma función que antes)
    def classify_burgers_vector(burgers_vector):
        if not burgers_vector or len(burgers_vector) != 3:
            return 'Other'
        
        bv = np.array(burgers_vector)
        magnitude = np.linalg.norm(bv)
        
        if magnitude < 1e-10:
            return 'Other'
        
        tolerance = 0.15
        import math
        
        burgers_types = {
            "1/2<111>": {
                "vectors": [
                    [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [0.5, -0.5, 0.5], [0.5, -0.5, -0.5],
                    [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, -0.5, -0.5]
                ],
                "magnitude_factor": math.sqrt(3)/2
            },
            "<100>": {
                "vectors": [
                    [1.0, 0.0, 0.0], [-1.0, 0.0, 0.0],
                    [0.0, 1.0, 0.0], [0.0, -1.0, 0.0],
                    [0.0, 0.0, 1.0], [0.0, 0.0, -1.0]
                ],
                "magnitude_factor": 1.0
            },
            "<110>": {
                "vectors": [
                    [1.0, 1.0, 0.0], [1.0, -1.0, 0.0], [-1.0, 1.0, 0.0], [-1.0, -1.0, 0.0],
                    [1.0, 0.0, 1.0], [1.0, 0.0, -1.0], [-1.0, 0.0, 1.0], [-1.0, 0.0, -1.0],
                    [0.0, 1.0, 1.0], [0.0, 1.0, -1.0], [0.0, -1.0, 1.0], [0.0, -1.0, -1.0]
                ],
                "magnitude_factor": math.sqrt(2)
            }
        }
        
        def vectors_are_parallel(v1, v2, tol=0.1):
            v1_norm = v1 / np.linalg.norm(v1) if np.linalg.norm(v1) > 0 else v1
            v2_norm = v2 / np.linalg.norm(v2) if np.linalg.norm(v2) > 0 else v2
            dot_product = abs(np.dot(v1_norm, v2_norm))
            return dot_product > (1.0 - tol)
        
        for burgers_type, type_info in burgers_types.items():
            expected_magnitude = type_info["magnitude_factor"]
            if abs(magnitude - expected_magnitude) / expected_magnitude < tolerance:
                for ref_vector in type_info["vectors"]:
                    ref_vec = np.array(ref_vector)
                    if vectors_are_parallel(bv, ref_vec, tolerance):
                        return burgers_type
        
        return 'Other'
    
    # Clasificar segmentos
    segments_by_type = {}
    for segment in dislocation_data:
        if 'burgers' in segment and 'vector' in segment['burgers']:
            burgers_vector = segment['burgers']['vector']
            burgers_type = classify_burgers_vector(burgers_vector)
        else:
            burgers_type = 'Other'
        
        if burgers_type not in segments_by_type:
            segments_by_type[burgers_type] = []
        segments_by_type[burgers_type].append(segment)
    
    # Crear actores
    actors = []
    for seg_type, segments in segments_by_type.items():
        color = type_colors.get(seg_type, type_colors['Other'])
        
        if tube_radius is not None:
            actor = create_high_res_tubes(segments, tube_radius, color, tube_resolution)
        else:
            if smooth_lines:
                actor = create_smooth_dislocation_lines(segments, line_width, color)
            else:
                actor = create_enhanced_lines(segments, line_width, color)
        
        if actor:
            actors.append(actor)
    
    return actors


def create_mesh_actors(data):
    """Crea actores para el interface mesh"""
    import vtk
    
    mesh_data = data['interface_mesh']['data']
    
    # Extraer puntos
    points = []
    for point_data in mesh_data.get('points', []):
        pos = point_data.get('position', [0, 0, 0])
        points.append([float(pos[0]), float(pos[1]), float(pos[2])])
    
    # Extraer facetas
    facets = []
    for facet_data in mesh_data.get('facets', []):
        vertices = facet_data.get('vertices', [])
        if len(vertices) >= 3:
            triangle = vertices[:3]
            if all(0 <= v < len(points) for v in triangle):
                facets.append(triangle)
    
    if not points or not facets:
        return []
    
    # Crear polydata
    polydata = vtk.vtkPolyData()
    vtk_points = vtk.vtkPoints()
    
    for point in points:
        vtk_points.InsertNextPoint(point[0], point[1], point[2])
    
    polydata.SetPoints(vtk_points)
    
    # Crear triángulos
    triangles = vtk.vtkCellArray()
    for facet in facets:
        triangle = vtk.vtkTriangle()
        triangle.GetPointIds().SetId(0, facet[0])
        triangle.GetPointIds().SetId(1, facet[1])
        triangle.GetPointIds().SetId(2, facet[2])
        triangles.InsertNextCell(triangle)
    
    polydata.SetPolys(triangles)
    
    # Calcular normales
    normals = vtk.vtkPolyDataNormals()
    normals.SetInputData(polydata)
    normals.ComputePointNormalsOn()
    normals.ComputeCellNormalsOn()
    
    # Mapper
    mapper = vtk.vtkPolyDataMapper()
    mapper.SetInputConnection(normals.GetOutputPort())
    
    # Actor
    actor = vtk.vtkActor()
    actor.SetMapper(mapper)
    actor.GetProperty().SetColor(0.0, 0.8, 1.0)  # Cyan
    actor.GetProperty().SetOpacity(0.7)  # Semi-transparente
    actor.GetProperty().SetSpecular(0.3)
    actor.GetProperty().SetSpecularPower(20)
    actor.GetProperty().SetInterpolationToPhong()
    
    return [actor]


def save_screenshot(render_window, filename="screenshot.png"):
    """Guarda una captura de pantalla"""
    import vtk
    
    w2if = vtk.vtkWindowToImageFilter()
    w2if.SetInput(render_window)
    w2if.SetScale(2)  # 2x resolución
    w2if.SetInputBufferTypeToRGBA()
    w2if.ReadFrontBufferOff()
    w2if.Update()
    
    writer = vtk.vtkPNGWriter()
    writer.SetFileName(filename)
    writer.SetInputConnection(w2if.GetOutputPort())
    writer.Write()
    
    print(f"Screenshot saved: {filename}")



def create_high_res_tubes(segments, tube_radius, color, resolution=16):
   """Tubos de alta resolución con caps mejorados"""
   import vtk
   
   # Crear polydata para todas las líneas
   polydata = vtk.vtkPolyData()
   points = vtk.vtkPoints()
   lines = vtk.vtkCellArray()
   
   point_id = 0
   
   for segment in segments:
       segment_points = segment.get('points', [])
       if len(segment_points) < 2:
           continue
       
       # Agregar puntos
       start_id = point_id
       for point in segment_points:
           points.InsertNextPoint(point[0], point[1], point[2])
           point_id += 1
       
       # Crear línea
       line = vtk.vtkPolyLine()
       line.GetPointIds().SetNumberOfIds(len(segment_points))
       for i in range(len(segment_points)):
           line.GetPointIds().SetId(i, start_id + i)
       
       lines.InsertNextCell(line)
   
   polydata.SetPoints(points)
   polydata.SetLines(lines)
   
   # Crear tubos con alta resolución
   tube_filter = vtk.vtkTubeFilter()
   tube_filter.SetInputData(polydata)
   tube_filter.SetRadius(tube_radius)
   tube_filter.SetNumberOfSides(resolution)
   tube_filter.SetVaryRadiusToVaryRadiusOff()
   tube_filter.CappingOn()
   
   # Suavizar la superficie
   smooth_filter = vtk.vtkSmoothPolyDataFilter()
   smooth_filter.SetInputConnection(tube_filter.GetOutputPort())
   smooth_filter.SetNumberOfIterations(10)
   smooth_filter.SetRelaxationFactor(0.1)
   
   # Mapper con interpolación suave
   mapper = vtk.vtkPolyDataMapper()
   mapper.SetInputConnection(smooth_filter.GetOutputPort())
   mapper.SetInterpolateScalarsBeforeMapping(True)
   
   # Actor con materiales mejorados
   actor = vtk.vtkActor()
   actor.SetMapper(mapper)
   actor.GetProperty().SetColor(color[0], color[1], color[2])
   actor.GetProperty().SetSpecular(0.4)
   actor.GetProperty().SetSpecularPower(30)
   actor.GetProperty().SetInterpolationToPhong()  # Interpolación Phong
   
   return actor


def create_smooth_dislocation_lines(segments, line_width, color):
   """Crea líneas suavizadas usando splines"""
   import vtk
   
   polydata = vtk.vtkPolyData()
   points = vtk.vtkPoints()
   lines = vtk.vtkCellArray()
   
   point_id = 0
   
   for segment in segments:
       segment_points = segment.get('points', [])
       if len(segment_points) < 2:
           continue
       
       # Si hay suficientes puntos, usar spline para suavizar
       if len(segment_points) > 3:
           # Crear spline
           spline = vtk.vtkParametricSpline()
           spline_points = vtk.vtkPoints()
           
           for point in segment_points:
               spline_points.InsertNextPoint(point[0], point[1], point[2])
           
           spline.SetPoints(spline_points)
           
           # Generar puntos suavizados
           function_source = vtk.vtkParametricFunctionSource()
           function_source.SetParametricFunction(spline)
           function_source.SetUResolution(len(segment_points) * 5)  # 5x más puntos
           function_source.Update()
           
           # Extraer puntos suavizados
           smooth_polydata = function_source.GetOutput()
           smooth_points = smooth_polydata.GetPoints()
           
           start_id = point_id
           for i in range(smooth_points.GetNumberOfPoints()):
               point = smooth_points.GetPoint(i)
               points.InsertNextPoint(point[0], point[1], point[2])
               point_id += 1
           
           # Crear línea suavizada
           line = vtk.vtkPolyLine()
           line.GetPointIds().SetNumberOfIds(smooth_points.GetNumberOfPoints())
           for i in range(smooth_points.GetNumberOfPoints()):
               line.GetPointIds().SetId(i, start_id + i)
           
           lines.InsertNextCell(line)
       else:
           # Línea normal para segmentos cortos
           start_id = point_id
           for point in segment_points:
               points.InsertNextPoint(point[0], point[1], point[2])
               point_id += 1
           
           line = vtk.vtkPolyLine()
           line.GetPointIds().SetNumberOfIds(len(segment_points))
           for i in range(len(segment_points)):
               line.GetPointIds().SetId(i, start_id + i)
           
           lines.InsertNextCell(line)
   
   polydata.SetPoints(points)
   polydata.SetLines(lines)
   
   # Mapper con anti-aliasing
   mapper = vtk.vtkPolyDataMapper()
   mapper.SetInputData(polydata)
   
   # Actor con mejor calidad
   actor = vtk.vtkActor()
   actor.SetMapper(mapper)
   actor.GetProperty().SetColor(color[0], color[1], color[2])
   actor.GetProperty().SetLineWidth(line_width)
   actor.GetProperty().SetRenderLinesAsTubes(True)  # Líneas como tubos
   
   return actor


def create_enhanced_lines(segments, line_width, color):
   """Líneas mejoradas sin tubos"""
   import vtk
   
   # Crear polydata
   polydata = vtk.vtkPolyData()
   points = vtk.vtkPoints()
   lines = vtk.vtkCellArray()
   
   point_id = 0
   
   for segment in segments:
       segment_points = segment.get('points', [])
       if len(segment_points) < 2:
           continue
       
       # Agregar puntos
       start_id = point_id
       for point in segment_points:
           points.InsertNextPoint(point[0], point[1], point[2])
           point_id += 1
       
       # Crear línea
       line = vtk.vtkPolyLine()
       line.GetPointIds().SetNumberOfIds(len(segment_points))
       for i in range(len(segment_points)):
           line.GetPointIds().SetId(i, start_id + i)
       
       lines.InsertNextCell(line)
   
   polydata.SetPoints(points)
   polydata.SetLines(lines)
   
   # Mapper mejorado
   mapper = vtk.vtkPolyDataMapper()
   mapper.SetInputData(polydata)
   
   # Actor con líneas como tubos
   actor = vtk.vtkActor()
   actor.SetMapper(mapper)
   actor.GetProperty().SetColor(color[0], color[1], color[2])
   actor.GetProperty().SetLineWidth(line_width)
   actor.GetProperty().SetRenderLinesAsTubes(True)  # Convierte líneas a tubos
   actor.GetProperty().SetVertexVisibility(False)
   actor.GetProperty().SetEdgeVisibility(False)
   
   return actor


def create_dislocation_points(segments, color):
   """Crea puntos para visualizar los nodos de las dislocaciones"""
   import vtk
   
   # Crear polydata
   polydata = vtk.vtkPolyData()
   points = vtk.vtkPoints()
   
   for segment in segments:
       segment_points = segment.get('points', [])
       for point in segment_points:
           points.InsertNextPoint(point[0], point[1], point[2])
   
   polydata.SetPoints(points)
   
   # Crear esferas para los puntos
   sphere = vtk.vtkSphereSource()
   sphere.SetRadius(0.1)
   sphere.SetThetaResolution(16)
   sphere.SetPhiResolution(16)
   
   glyph = vtk.vtkGlyph3D()
   glyph.SetInputData(polydata)
   glyph.SetSourceConnection(sphere.GetOutputPort())
   
   # Mapper
   mapper = vtk.vtkPolyDataMapper()
   mapper.SetInputConnection(glyph.GetOutputPort())
   
   # Actor
   actor = vtk.vtkActor()
   actor.SetMapper(mapper)
   actor.GetProperty().SetColor(color[0], color[1], color[2])
   actor.GetProperty().SetOpacity(0.7)
   actor.GetProperty().SetSpecular(0.3)
   actor.GetProperty().SetInterpolationToPhong()
   
   return actor


# Uso:
# visualize_dislocations_vtk_hd("analysis.json", line_width=4.0, smooth_lines=True)
# visualize_dislocations_vtk_hd("analysis.json", tube_radius=0.03, tube_resolution=24)