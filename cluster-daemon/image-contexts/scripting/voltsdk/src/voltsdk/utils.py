from typing import Any, Optional
import msgpack
import os
import pandas as pd
import vtk


def get_nested_value(data: Any, path: Optional[str]) -> Any:
    if not path:
        return data

    current = data
    for key in path.split('.'):
        if not isinstance(current, dict):
            return None

        if key not in current:
            return None

        current = current[key]

    return current


def merged_chunked_value(target: Any, incoming: Any) -> Any:
    if incoming is None:
        return target

    if target is None:
        return incoming

    if isinstance(target, list) and isinstance(incoming, list):
        target.extend(incoming)
        return target

    if isinstance(target, dict) and isinstance(incoming, dict):
        for key, incoming_value in incoming.items():
            target_value = target.get(key)

            if isinstance(target_value, list) and isinstance(incoming_value, list):
                target_value.extend(incoming_value)
            elif isinstance(target_value, dict) and isinstance(incoming_value, dict):
                target[key] = merged_chunked_value(target_value, incoming_value)
            else:
                target[key] = incoming_value
        return target

    return incoming


def is_columnar_dict(value: Any) -> bool:
    if not isinstance(value, dict) or not value:
        return False

    lengths = []
    for item in value.values():
        if not isinstance(item, list):
            return False
        lengths.append(len(item))
    return len(set(lengths)) == 1


def msgpack_as_df(file_path: str, iterable_key: Optional[str] = None):
    if not os.path.exists(file_path):
        raise RuntimeError(f'file not found: {file_path}')

    data = None
    with open(file_path, 'rb') as file:
        unpacker = msgpack.Unpacker(file, raw=False)
        for message in unpacker:
            chunk = get_nested_value(message, iterable_key)
            data = merged_chunked_value(data, chunk)

        if data is None:
            return pd.DataFrame()

        if isinstance(data, list) or is_columnar_dict(data):
            return pd.DataFrame(data)

        if isinstance(data, dict):
            return pd.DataFrame([data])

        return pd.DataFrame([{'value': data}])


def view_glb(file_path: str):
    if not os.path.exists(file_path):
        raise RuntimeError(f'file not found: {file_path}')

    reader = vtk.vtkGLTFReader()
    reader.SetFileName(file_path)
    reader.Update()

    in_notebook = False
    try:
        from IPython import get_ipython
        shell = get_ipython()
        in_notebook = shell is not None and shell.__class__.__name__ == 'ZMQInteractiveShell'
    except Exception:
        in_notebook = False

    if in_notebook:
        try:
            import k3d
        except Exception as error:
            raise RuntimeError('k3d is required in notebook mode. Install with: pip install k3d') from error

        plot = k3d.plot()
        multi_block = reader.GetOutput()
        iterator = multi_block.NewIterator()
        iterator.InitTraversal()
        while not iterator.IsDoneWithTraversal():
            item = iterator.GetCurrentDataObject()
            if item is not None:
                plot += k3d.vtk_poly_data(item, color=0x222222)
            iterator.GoToNextItem()

        try:
            from IPython.display import display as ipython_display
            ipython_display(plot)
        except Exception:
            pass

        return plot

    mapper = vtk.vtkCompositePolyDataMapper2()
    mapper.SetInputDataObject(reader.GetOutput())

    actor = vtk.vtkActor()
    actor.SetMapper(mapper)

    renderer = vtk.vtkRenderer()
    renderer.AddActor(actor)
    renderer.SetBackground(0.07, 0.07, 0.07)

    render_window = vtk.vtkRenderWindow()
    render_window.AddRenderer(renderer)
    render_window.SetSize(1200, 800)
    render_window.SetWindowName(os.path.basename(file_path))

    interactor = vtk.vtkRenderWindowInteractor()
    interactor.SetRenderWindow(render_window)

    render_window.Render()
    interactor.Initialize()
    interactor.Start()

    return interactor
