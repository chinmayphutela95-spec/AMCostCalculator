import sys
import types

# Provide a minimal networkx stub so trimesh doesn't fail if networkx is absent.
try:
    import networkx  # noqa: F401
except ModuleNotFoundError:
    _nx = types.ModuleType("networkx")
    sys.modules["networkx"] = _nx

import trimesh
import numpy as np
import os
import math


def _load_mesh(file_path: str) -> trimesh.Trimesh:
    """Load any STL/STEP/OBJ file and return a single Trimesh, always."""
    loaded = trimesh.load(file_path, force='mesh')

    # Already a Trimesh
    if isinstance(loaded, trimesh.Trimesh):
        return loaded

    # It's a Scene — dump all sub-geometry into one mesh
    if isinstance(loaded, trimesh.Scene):
        geoms = list(loaded.geometry.values())
        if not geoms:
            raise ValueError("File contains no geometry.")
        if len(geoms) == 1:
            mesh = geoms[0]
        else:
            mesh = trimesh.util.concatenate(geoms)
        if isinstance(mesh, trimesh.Trimesh):
            return mesh

    # Last resort: try extracting vertices/faces directly
    raise ValueError(f"Could not extract a mesh from file (got {type(loaded).__name__}).")


def _parse_build_vec(build_direction: str):
    """
    Parse a build-direction string → (build_vec, primary_axis_or_None).

    Accepted values:
      'x', 'y', 'z'          — positive axis pointing up (build direction)
      '-x', '-y', '-z'       — negative axis pointing up
      'custom:nx,ny,nz'      — arbitrary unit vector (will be normalised)

    Returns (np.ndarray shape (3,), int|None).
    primary_axis is 0/1/2 for axis-aligned directions (used for fast
    bounding-box projected-area); None for arbitrary directions.
    """
    d = build_direction.strip().lower()
    presets = {
        'x':  (np.array([1., 0., 0.]), 0),
        'y':  (np.array([0., 1., 0.]), 1),
        'z':  (np.array([0., 0., 1.]), 2),
        '-x': (np.array([-1., 0., 0.]), 0),
        '-y': (np.array([0., -1., 0.]), 1),
        '-z': (np.array([0., 0., -1.]), 2),
    }
    if d in presets:
        return presets[d]
    if d.startswith('custom:'):
        try:
            parts = d[7:].split(',')
            vec = np.array([float(p) for p in parts[:3]])
            norm = np.linalg.norm(vec)
            if norm > 1e-6:
                return (vec / norm, None)
        except (ValueError, IndexError):
            pass
    return (np.array([0., 0., 1.]), 2)   # default: Z up


def parse_stl(file_path: str, build_direction: str = "z", overhang_angle_deg: float = 45.0, fill_density: float = 0.3) -> dict:
    """
    Parse STL/STEP/OBJ and return geometric properties for cost calculation.
    All linear dimensions assumed in mm (standard STL unit).
    """
    try:
        mesh = _load_mesh(file_path)

        if len(mesh.vertices) == 0 or len(mesh.faces) == 0:
            return {"success": False, "error": "Mesh has no geometry (0 vertices or faces)."}

        # ── Volume ────────────────────────────────────────────────
        volume_mm3 = float(abs(mesh.volume))
        volume_cm3 = volume_mm3 / 1000.0

        # ── Bounding box (axis-aligned, for reference) ────────────
        bounds = mesh.bounds
        extents = mesh.extents

        if bounds is None or extents is None:
            verts_raw = np.array(mesh.vertices)
            mins = verts_raw.min(axis=0)
            maxs = verts_raw.max(axis=0)
            extents = maxs - mins
            bounds = np.array([mins, maxs])

        extents = np.asarray(extents, dtype=float)
        bounds  = np.asarray(bounds,  dtype=float)

        # ── Build direction → unit vector ─────────────────────────
        build_vec, primary_axis = _parse_build_vec(build_direction)

        # ── Height along build direction ──────────────────────────
        verts = np.asarray(mesh.vertices, dtype=float)
        build_projections = verts @ build_vec          # scalar projection per vertex
        height_mm = float(build_projections.max() - build_projections.min())
        height_cm = height_mm / 10.0
        min_build_proj = float(build_projections.min())  # passed to support estimator

        # ── Projected area perpendicular to build direction ───────
        if primary_axis is not None:
            # Fast path: axis-aligned direction — use bounding-box extents
            other_axes = [i for i in range(3) if i != primary_axis]
            projected_area_cm2 = float(extents[other_axes[0]] * extents[other_axes[1]]) / 100.0
        else:
            # General: project vertices onto the plane perpendicular to build_vec
            ref = np.array([1., 0., 0.]) if abs(build_vec[0]) < 0.9 else np.array([0., 1., 0.])
            perp1 = np.cross(build_vec, ref); perp1 /= np.linalg.norm(perp1)
            perp2 = np.cross(build_vec, perp1)
            p1 = verts @ perp1;  p2 = verts @ perp2
            projected_area_cm2 = float(
                (p1.max() - p1.min()) * (p2.max() - p2.min())
            ) / 100.0

        # ── Surface area ──────────────────────────────────────────
        surface_area_cm2 = float(mesh.area) / 100.0

        # ── Relative density ──────────────────────────────────────
        bbox_vol_cm3 = float(extents[0] * extents[1] * extents[2]) / 1000.0
        relative_density = volume_cm3 / bbox_vol_cm3 if bbox_vol_cm3 > 0 else 1.0

        # ── Support estimation ────────────────────────────────────
        support_data = estimate_support_volume(
            mesh, build_vec, min_build_proj, volume_cm3, overhang_angle_deg, fill_density
        )

        # ── Watertight ────────────────────────────────────────────
        try:
            is_watertight = bool(mesh.is_watertight)
        except Exception:
            is_watertight = False

        return {
            "success": True,
            "volume_cm3":          round(volume_cm3, 4),
            "height_cm":           round(height_cm, 4),
            "projected_area_cm2":  round(projected_area_cm2, 4),
            "surface_area_cm2":    round(surface_area_cm2, 4),
            "bounding_box_mm": {
                "x": round(float(extents[0]), 2),
                "y": round(float(extents[1]), 2),
                "z": round(float(extents[2]), 2),
            },
            "relative_density":      round(min(relative_density, 1.0), 4),
            "support_volume_cm3":    round(support_data["support_volume_cm3"], 4),
            "support_area_cm2":      round(support_data["overhang_area_cm2"], 4),
            "estimated_support_pct": round(support_data["support_volume_pct"], 4),
            "face_count":    int(len(mesh.faces)),
            "vertex_count":  int(len(mesh.vertices)),
            "build_direction": build_direction,
            "is_watertight":   is_watertight,
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


def estimate_support_volume(
    mesh: trimesh.Trimesh,
    build_vec: np.ndarray,
    min_build_proj: float,
    part_volume_cm3: float = 0.0,
    overhang_angle_deg: float = 45.0,
    fill_density: float = 0.3,
) -> dict:
    """
    Estimate support volume from overhang analysis.

    For each overhang face a downward ray is cast from the face centroid to
    find where the support column lands — on the part surface if there is
    geometry below (e.g. a bridge between two pillars), or on the build plate
    if there is nothing. This avoids the overestimation that occurs when
    overhangs sit above other sections of the same part.

    For meshes with > 150 000 faces the ray-cast is skipped (falls back to
    build-plate distance) to keep response time reasonable.
    fill_density scales the solid fraction of the support structure
    (e.g. 0.40 for block, 0.12 for lattice/cone).
    """
    try:
        build_vec = np.asarray(build_vec, dtype=float)

        face_normals   = np.asarray(mesh.face_normals,     dtype=float)
        face_areas     = np.asarray(mesh.area_faces,       dtype=float)
        face_centroids = np.asarray(mesh.triangles_center, dtype=float)

        threshold    = -math.sin(math.radians(overhang_angle_deg))
        dot_products = face_normals @ build_vec
        overhang_mask = dot_products < threshold

        overhang_area_mm2 = float(face_areas[overhang_mask].sum())
        overhang_area_cm2 = overhang_area_mm2 / 100.0

        overhang_centroids = face_centroids[overhang_mask]
        n_overhangs        = overhang_centroids.shape[0]

        # Project centroids onto build direction; height above build plate
        centroid_projs = overhang_centroids @ build_vec          # (n,)
        heights_mm     = centroid_projs - min_build_proj
        heights_mm     = np.maximum(heights_mm, 0.0)

        # ── Ray-cast downward to find actual floor ─────────────────────────
        # Cast one ray per overhang centroid in the -build_vec direction.
        # The highest (nearest) intersection below is the support floor —
        # part surface if there's geometry below, otherwise the build plate.
        if n_overhangs > 0 and len(mesh.faces) <= 150_000:
            try:
                eps       = 0.05                          # mm offset to avoid self-hit
                ray_dirs  = np.tile(-build_vec, (n_overhangs, 1))
                ray_origins = overhang_centroids + ray_dirs * eps

                locations, index_ray, _ = mesh.ray.intersects_location(
                    ray_origins=ray_origins,
                    ray_directions=ray_dirs,
                    multiple_hits=True,
                )

                if len(locations) > 0:
                    # Project hit locations onto build direction
                    hit_proj      = locations @ build_vec
                    centroid_proj = overhang_centroids[index_ray] @ build_vec
                    below_mask    = hit_proj < centroid_proj - eps * 2

                    if below_mask.any():
                        valid_floor = hit_proj[below_mask]
                        valid_rays  = index_ray[below_mask]

                        # For each ray: highest projection = nearest surface below
                        best_floor = np.full(n_overhangs, min_build_proj)
                        np.maximum.at(best_floor, valid_rays, valid_floor)

                        improved = best_floor > min_build_proj
                        heights_mm[improved] = (
                            centroid_projs[improved] - best_floor[improved]
                        )
                        heights_mm = np.maximum(heights_mm, 0.0)
            except Exception:
                pass  # keep build-plate heights on any ray-cast failure

        # Projected area of each face onto the build plane (mm²)
        projected_areas_mm2 = face_areas[overhang_mask] * np.abs(dot_products[overhang_mask])

        # Support column volume = projected_area × height, scaled by fill density
        support_vol_mm3 = float((projected_areas_mm2 * heights_mm).sum()) * fill_density
        support_vol_cm3 = support_vol_mm3 / 1000.0

        vol = part_volume_cm3 if part_volume_cm3 > 0 else max(float(abs(mesh.volume)) / 1000.0, 1e-9)
        support_pct = min(support_vol_cm3 / vol * 100, 100.0)

        return {
            "overhang_area_cm2":  overhang_area_cm2,
            "support_volume_cm3": support_vol_cm3,
            "support_volume_pct": support_pct,
        }
    except Exception:
        return {"overhang_area_cm2": 0.0, "support_volume_cm3": 0.0, "support_volume_pct": 0.0}


def compute_mass(volume_cm3: float, density_g_cm3: float) -> float:
    """Compute mass in kg from volume (cm³) and density (g/cm³)."""
    return volume_cm3 * density_g_cm3 / 1000.0
