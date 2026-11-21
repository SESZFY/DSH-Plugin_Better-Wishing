import argparse
import csv
import json
import platform
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
from matplotlib import pyplot as plt
import numpy as np
import scipy
from scipy.interpolate import CubicSpline, interp1d
from scipy.optimize import minimize


LABELS = {'cold': 'Cold', 'fermi-dirac': 'Fermi–Dirac', 'gaussian': 'Gaussian'}
STYLES = {'cold': ':', 'fermi-dirac': '-', 'gaussian': '--'}
PALETTES = {
    'cold': ['#193c78', '#275c9a', '#3076b3', '#5695c0'],
    'fermi-dirac': ['#861d2f', '#a83445', '#be4c54', '#d57475'],
    'gaussian': ['#145445', '#257258', '#318868', '#56a184'],
}
ATOMS_PER_CELL = 2
WINDOWS = [(25, 45, 30), (50, 95, 90)]


def validated_curves(data):
    seen = set()
    for item in data:
        kind, width = item['smearing_type'], item['degauss_meV']
        volumes = np.asarray(item['volumes'], dtype=float) / ATOMS_PER_CELL
        energies = np.asarray(item['energies'], dtype=float) / ATOMS_PER_CELL
        if kind not in LABELS or (kind, width) in seen or not np.isfinite(width) or width <= 0:
            raise ValueError('Invalid or repeated smearing condition')
        if (volumes.ndim != 1 or energies.shape != volumes.shape or len(volumes) < 4
                or not np.isfinite(volumes).all() or not np.isfinite(energies).all()
                or np.any(np.diff(volumes) <= 0) or volumes[0] > 25 or volumes[-1] < 95):
            raise ValueError(f'Invalid volume or energy samples for {kind} {width}')
        seen.add((kind, width))
        yield kind, width, volumes, energies
    if len(seen) != 12 or any(sum(kind == pair[0] for pair in seen) != 4 for kind in LABELS):
        raise ValueError('Fig. 3 requires four curves for each of three smearing methods')


def exact_minima(spline):
    roots = spline.derivative().roots(extrapolate=False)
    minima = []
    for lower, upper, _initial in WINDOWS:
        candidates = [v for v in roots if lower + 0.5 < v < upper - 0.5 and spline(v, 2) > 0]
        minima.append(float(min(candidates, key=spline)) if candidates else None)
    return minima


def reference_minima(interpolator):
    output = []
    for lower, upper, initial in WINDOWS:
        fit = minimize(lambda x: float(interpolator(x[0])), [initial], bounds=[(lower, upper)],
                       method='Nelder-Mead', options={'xatol': 5e-5})
        point = float(fit.x[0])
        output.append(point if fit.success and lower + 0.5 < point < upper - 0.5 else None)
    return output


def reproduce(input_file, output_dir):
    curves = []
    for kind, width, volumes, energies in validated_curves(json.loads(input_file.read_text(encoding='utf-8'))):
        spline = CubicSpline(volumes, energies)
        reference = interp1d(volumes, energies, kind='cubic')
        grid = np.linspace(volumes[0], volumes[-1], 1000)
        curves.append((kind, width, grid, spline, reference, exact_minima(spline), reference_minima(reference)))
    zero = min(float(spline(grid).min()) for _, _, grid, spline, _, _, _ in curves)
    reference_zero = min(float(reference(grid).min()) for _, _, grid, _, reference, _, _ in curves)

    fig, ax = plt.subplots(figsize=(8.5, 5.8), layout='constrained')
    ax.set_title('Smearing changes the equation of state of diamond-structure Er', loc='left', pad=14, fontsize=13)
    ax.set(xlabel=r'Volume per atom ($\mathrm{\AA^3}$)', ylabel='Relative free energy per atom (eV)', xlim=(30, 100), ylim=(0, 0.70))
    ax.spines[['top', 'right']].set_visible(False)
    ax.grid(axis='y', color='#e5e8eb', linewidth=0.8)
    details = []
    color_positions = dict.fromkeys(LABELS, 0)
    with (output_dir / 'curves.csv').open('w', encoding='utf-8', newline='') as handle:
        writer = csv.writer(handle)
        writer.writerow(['smearing', 'width_meV', 'volume_A3_per_atom', 'free_energy_eV_per_atom', 'reference_eV_per_atom'])
        for kind, width, grid, spline, reference, minima, published in sorted(curves, key=lambda entry: (list(LABELS).index(entry[0]), entry[1])):
            color = PALETTES[kind][color_positions[kind]]
            color_positions[kind] += 1
            plotted = spline(grid) - zero
            ref = reference(grid) - reference_zero
            ax.plot(grid, plotted, STYLES[kind], color=color, label=f'{LABELS[kind]} {width:g} meV', linewidth=1.5)
            for point in published:
                if point is not None:
                    ax.plot(point, spline(point) - zero, marker='x', color=color, markersize=4, markeredgewidth=0.9)
            writer.writerows((kind, width, float(v), float(e), float(r)) for v, e, r in zip(grid, plotted, ref))
            details.append({
                'kind': kind, 'width_meV': width,
                'max_curve_error_eV_per_atom': float(np.max(np.abs(plotted - ref))),
                'minima_A3_per_atom': minima, 'reference_minima_A3_per_atom': published,
                'minima_eV_per_atom': [float(spline(v) - zero) if v is not None else None for v in minima],
            })
    ax.legend(loc='upper center', ncol=3, frameon=False, fontsize=8)
    fig.savefig(output_dir / 'figure.png', dpi=240, facecolor='white')
    plt.close(fig)
    result = {'grid_points_per_curve': 1000, 'environment': {'python': platform.python_version(), 'numpy': np.__version__, 'scipy': scipy.__version__, 'matplotlib': matplotlib.__version__}, 'curves': details}
    (output_dir / 'metrics.json').write_text(json.dumps(result, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    print(f'Computed {len(details)} curves with 1000 samples each from the public Quantum ESPRESSO results.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Redraw Bosoni et al. Fig. 3 from the authors’ published EOS samples')
    parser.add_argument('input_file', type=Path)
    parser.add_argument('output_dir', type=Path)
    arguments = parser.parse_args()
    reproduce(arguments.input_file, arguments.output_dir)
