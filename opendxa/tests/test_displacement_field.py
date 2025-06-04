from opendxa.classification.displacement import DisplacementFieldAnalyzer
import numpy as np
import pytest
import logging

logging.getLogger('opendxa').setLevel(logging.WARNING)

class DummyCUDA:
    '''
    A dummy replacement for cuda.device_array & cuda.to_device that bypasses actual GPU calls.
    We'll monkeypatch the kernel launch inside compute_displacement_field_gpu so it writes
    a known output into the 'device' array, then copy_to_host simply returns that array.
    '''
    class DeviceArray:
        def __init__(self, shape, dtype):
            self._host = np.zeros(shape, dtype=dtype)

        def copy_to_host(self):
            return self._host

    @staticmethod
    def to_device(arr):
        # Wrap a numpy array in a dummy that has 'copy_to_host()'
        class Wrapper:
            def __init__(self, a):
                self._host = a

            def copy_to_host(self):
                return self._host

        return Wrapper(np.array(arr))

    @staticmethod
    def device_array(shape, dtype):
        return DummyCUDA.DeviceArray(shape, dtype)

@pytest.fixture(autouse=True)
def patch_cuda(monkeypatch):
    '''
    Replace numba.cuda calls used inside compute_displacement_field_gpu with DummyCUDA.
    Also replace the actual kernel launch with a no‐op that fills a known pattern.
    '''
    import numba.cuda as _cuda_mod

    # Monkey‐patch cuda.to_device and cuda.device_array
    monkeypatch.setattr(_cuda_mod, 'to_device', DummyCUDA.to_device)
    monkeypatch.setattr(_cuda_mod, 'device_array', DummyCUDA.device_array)

    # Intercept the kernel object inside compute_displacement_field_gpu:
    # It expects to find `gpu_compute_displacement_field_kernel_pbc` in the same module.
    from opendxa.utils.cuda import gpu_compute_displacement_field_kernel_pbc

    def fake_kernel_launch(*args, **kwargs):
        '''
        When invoked, args[-1] is d_displacement_vectors, a DeviceArray.
        We will pretend that the kernel computes a displacement vector of [i, 2*i, 3*i]
        for each atom index i.
        The signature is:
            (
              d_positions,
              d_connectivity_data,
              d_connectivity_offsets,
              d_types,
              d_quaternions,
              d_templates,
              d_template_sizes,
              d_box_bounds,
              d_pbc_flags,
              d_displacement_vectors,
              num_atoms
            )
        '''
        # The second‐to‐last argument is the DeviceArray we need to fill.
        # Actually, in our Cpu‐side DummyCUDA, `device_array.copy_to_host()` returns _host.
        # We extract that DeviceArray instance and fill its ._host field.
        device_out = args[-2]
        num_atoms = args[-1]

        # Fill with a simple pattern: b[i] = [i, 2*i, 3*i]
        for i in range(num_atoms):
            device_out._host[i, 0] = float(i)
            device_out._host[i, 1] = float(2 * i)
            device_out._host[i, 2] = float(3 * i)

    # Monkeypatch the kernel launch (which is a CUDADispatcher) to our fake
    monkeypatch.setattr(
        'opendxa.utils.cuda.gpu_compute_displacement_field_kernel_pbc',
        fake_kernel_launch
    )

    yield 

def test_displacement_field_analyzer_average_magnitudes(monkeypatch):
    '''
    Monkeypatch compute_displacement_field_gpu to return multiple displacement vectors
    for one atom, and a single vector for another atom. Verify that avg is computed correctly.
    '''
    # Build dummy inputs for the analyzer
    positions = np.random.rand(4, 3).astype(np.float32)
    connectivity = {
        0: [1],  # will not actually be used by the stub
        1: [0, 2],
        2: [1],
        3: []
    }
    types = np.zeros(4, dtype=int)
    quaternions = np.zeros((4, 4), dtype=np.float32)  # not used by our stub
    quaternions[:, 0] = 1.0
    templates = np.zeros((1, 1, 3), dtype=np.float32)
    template_sizes = np.array([1], dtype=int)
    box_bounds = None

    # Prepare a fake disp_dict:
    #   - Atom 0 -> single vector [3, 4, 0] (norm = 5)
    #   - Atom 1 -> two vectors: [1,0,0], [0,2,0] ⇒ norms 1 and 2 ⇒ avg = 1.5
    #   - Atom 2 -> no entry (treat as zero)
    #   - Atom 3 -> one vector [0, -3, -4] (norm = 5)
    fake_disp = {
        0: np.array([3.0, 4.0, 0.0], dtype=np.float32),
        1: np.array([[1.0, 0.0, 0.0],
                     [0.0, 2.0, 0.0]], dtype=np.float32),
        3: np.array([0.0, -3.0, -4.0], dtype=np.float32)
    }

    # Monkeypatch the GPU‐call inside DisplacementFieldAnalyzer to return fake_disp
    monkeypatch.setattr(
        'opendxa.classification.displacement.compute_displacement_field_gpu',
        lambda *args, **kwargs: fake_disp
    )

    analyzer = DisplacementFieldAnalyzer(
        positions=positions,
        connectivity=connectivity,
        types=types,
        quaternions=quaternions,
        templates=templates,
        template_sizes=template_sizes,
        box_bounds=box_bounds
    )

    disp_dict, avg = analyzer.compute_displacement_field()

    # Atom 0 -> norm([3,4,0]) = 5
    # Atom 1 -> norms [1,2] ⇒ avg = 1.5
    # Atom 2 -> not in fake_disp ⇒ avg remains 0
    # Atom 3 -> norm([0,-3,-4]) = 5
    assert set(disp_dict.keys()) == {0, 1, 3}

    expected_avg = np.array([5.0, 1.5, 0.0, 5.0], dtype=np.float32)
    assert avg.shape == (4,)
    assert np.allclose(avg, expected_avg, atol=1e-5)

def test_displacement_field_analyzer_empty_return(monkeypatch):
    '''
    If the GPU routine returns an empty dict, we expect avg to be all zeros.
    '''
    positions = np.zeros((2, 3), dtype=np.float32)
    connectivity = {0: [], 1: []}
    types = np.zeros(2, dtype=int)
    quaternions = np.zeros((2, 4), dtype=np.float32)
    quaternions[:, 0] = 1.0
    templates = np.zeros((1, 1, 3), dtype=np.float32)
    template_sizes = np.array([1], dtype=int)

    monkeypatch.setattr(
        'opendxa.classification.displacement.compute_displacement_field_gpu',
        lambda *args, **kwargs: {}
    )

    analyzer = DisplacementFieldAnalyzer(
        positions=positions,
        connectivity=connectivity,
        types=types,
        quaternions=quaternions,
        templates=templates,
        template_sizes=template_sizes,
        box_bounds=None
    )

    disp_dict, avg = analyzer.compute_displacement_field()
    assert disp_dict == {}
    assert avg.shape == (2,)
    assert np.allclose(avg, np.zeros(2, dtype=np.float32))

if __name__ == '__main__':
    pytest.main([__file__])
