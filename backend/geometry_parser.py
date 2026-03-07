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


def parse_stl(file_path: str, build_direction: str = "z") -> dict:
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

        # ── Bounding box ──────────────────────────────────────────
        bounds = mesh.bounds          # shape (2, 3) or None
        extents = mesh.extents        # shape (3,)   or None

        if bounds is None or extents is None:
            # Compute manually from vertices
            verts = np.array(mesh.vertices)
            mins = verts.min(axis=0)
            maxs = verts.max(axis=0)
            extents = maxs - mins
            bounds = np.array([mins, maxs])

        extents = np.asarray(extents, dtype=float)
        bounds  = np.asarray(bounds,  dtype=float)

        # ── Build direction mapping ───────────────────────────────
        axis_map = {'x': 0, 'y': 1, 'z': 2}
        build_axis = axis_map.get(build_direction.lower(), 2)
        other_axes = [i for i in range(3) if i != build_axis]

        height_cm         = float(extents[build_axis]) / 10.0
        projected_area_cm2 = float(extents[other_axes[0]] * extents[other_axes[1]]) / 100.0

        # ── Surface area ──────────────────────────────────────────
        surface_area_cm2 = float(mesh.area) / 100.0

        # ── Relative density ──────────────────────────────────────
        bbox_vol_cm3 = float(extents[0] * extents[1] * extents[2]) / 1000.0
        relative_density = volume_cm3 / bbox_vol_cm3 if bbox_vol_cm3 > 0 else 1.0

        # ── Support estimation ────────────────────────────────────
        support_data = estimate_support_volume(mesh, bounds, build_axis, volume_cm3)

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
    bounds: np.ndarray,
    build_axis: int = 2,
    part_volume_cm3: float = 0.0,
    overhang_angle_deg: float = 45.0,
) -> dict:
    """Estimate support volume from overhang analysis (pure numpy, no networkx)."""
    try:
        build_vec = np.zeros(3)
        build_vec[build_axis] = 1.0

        face_normals = np.asarray(mesh.face_normals, dtype=float)
        face_areas   = np.asarray(mesh.area_faces,   dtype=float)

        threshold    = -math.cos(math.radians(overhang_angle_deg))
        dot_products = face_normals @ build_vec
        overhang_mask = dot_products < threshold

        overhang_area_mm2 = float(face_areas[overhang_mask].sum())
        overhang_area_cm2 = overhang_area_mm2 / 100.0

        build_extent_mm   = float(bounds[1][build_axis] - bounds[0][build_axis])
        avg_height_mm     = build_extent_mm * 0.2
        support_vol_mm3   = overhang_area_mm2 * avg_height_mm * 0.3
        support_vol_cm3   = support_vol_mm3 / 1000.0

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
