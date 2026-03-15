from dataclasses import dataclass, field
from typing import Optional
import math


@dataclass
class CostInputs:
    # Part parameters
    part_mass: float          # kg
    part_volume: float        # cm³
    part_height: float        # cm (in build orientation)
    part_projected_area: float  # cm² (in build orientation)
    support_pct_of_mass: float  # fraction (e.g., 0.20 = 20%)

    # Production
    production_run: int       # number of parts

    # Machine parameters
    machine_cost: float       # $
    machine_lifetime: float   # years
    cost_of_capital: float    # fraction
    infrastructure_pct: float # fraction
    maintenance_pct: float    # fraction
    build_area: float         # cm²
    build_height: float       # cm
    build_rate: float         # cm³/hr
    uptime: float             # fraction

    # Packing
    packing_policy: str       # "2D" or "3D"
    packing_fraction: float   # fraction
    recycling_fraction: float # fraction

    # Material
    material_cost_per_kg: float  # $/kg
    material_density: float      # g/cm³

    # Consumables
    inert_gas_cost: float           # $/hr
    consumable_cost_per_build: float # $

    # Time parameters
    first_build_prep_time: float        # hr
    subsequent_build_prep_time: float   # hr
    setup_time_per_build: float         # hr
    removal_time_per_build: float       # hr
    warmup_time: float                  # hr
    cooldown_time: float                # hr
    support_constant: float             # c in t = c * A^0.5

    # Operations
    hours_per_day: float
    days_per_week: float
    fte_supervised: float
    fte_build_exchange: float
    fte_support_removal: float
    salary_engineer: float    # $/hr
    salary_operator: float    # $/hr
    salary_technician: float  # $/hr

    # Multi-laser configuration
    laser_multiplier: int = 1   # effective lasers contributing to print speed (1 = single laser)

    # Elevation: height of part bottom above build plate (cm); kept separate from part_height
    # so that 3D-packing layer counts and job_height are computed correctly.
    elevation_cm: float = 0.0

    # User override: if set, skip packing calculation and use this value directly
    parts_per_build_override: Optional[int] = None

    # Recoating parameters
    layer_thickness_um: float = 40.0              # µm — from material; needed for layer count
    recoating_distance_mm: Optional[float] = None # full chamber travel (end-to-end incl. margins)
    recoating_speed_mm_s: Optional[float] = None  # average recoater speed (mm/s)
    recoating_efficiency: float = 1.0             # fallback: fraction of active time that is laser scan
                                                  # (e.g. 0.75 → 33% overhead; ignored when distance+speed set)

    # Metal AM extensions (optional)
    heat_treatment_enabled: bool = False
    heat_treatment_cost_per_build: float = 0.0
    part_separation_enabled: bool = False
    part_separation_cost_per_part: float = 0.0
    hip_enabled: bool = False
    hip_cost_per_part: float = 0.0
    surface_treatment_enabled: bool = False
    surface_treatment_cost_per_part: float = 0.0
    ndt_enabled: bool = False
    ndt_cost_per_part: float = 0.0


@dataclass
class CostBreakdown:
    # Intermediate values
    parts_per_build: int
    num_builds: int
    support_mass_per_part: float  # kg

    # Material
    total_part_material: float    # kg
    total_support_material: float # kg
    total_build_material: float   # kg
    recycled_material: float      # kg
    material_waste: float         # kg
    material_required: float      # kg
    material_cost: float          # $

    # Build preparation
    build_prep_time: float        # hr
    build_prep_cost: float        # $

    # Machine
    annual_depreciation: float        # $/yr
    annual_maintenance: float         # $/yr
    annual_machine_cost: float        # $/yr
    operating_hours_per_year: float   # hr/yr
    machine_cost_per_hour: float      # $/hr
    total_warmup_time: float          # hr
    total_scan_time: float            # hr — laser scan only
    total_recoating_time: float       # hr — recoating overhead
    total_print_time: float           # hr — scan + recoating (used for machine/gas/labor cost)
    total_cooldown_time: float        # hr
    total_build_exchange_time: float  # hr
    total_machine_time: float         # hr
    machine_cost: float               # $

    # Consumables
    inert_gas_cost: float         # $
    per_build_consumables: float  # $
    consumables_cost: float       # $

    # Labor
    labor_during_build: float     # hr
    labor_build_exchange: float   # hr
    total_labor_hours: float      # hr
    labor_cost: float             # $

    # Post-process (support removal)
    support_removal_time: float   # hr
    post_process_cost: float      # $

    # Metal AM extensions
    heat_treatment_cost: float = 0.0
    part_separation_cost: float = 0.0
    hip_cost: float = 0.0
    surface_treatment_cost: float = 0.0
    ndt_cost: float = 0.0

    # Totals
    total_cost: float = 0.0
    cost_per_part: float = 0.0

    def to_dict(self):
        return {
            "parts_per_build": self.parts_per_build,
            "num_builds": self.num_builds,
            "support_mass_per_part": self.support_mass_per_part,
            "material": {
                "total_part_material_kg": self.total_part_material,
                "total_support_material_kg": self.total_support_material,
                "total_build_material_kg": self.total_build_material,
                "recycled_material_kg": self.recycled_material,
                "material_waste_kg": self.material_waste,
                "material_required_kg": self.material_required,
                "cost": self.material_cost
            },
            "build_prep": {
                "total_time_hr": self.build_prep_time,
                "cost": self.build_prep_cost
            },
            "machine": {
                "annual_depreciation": self.annual_depreciation,
                "annual_maintenance": self.annual_maintenance,
                "machine_cost_per_hour": self.machine_cost_per_hour,
                "total_warmup_hr": self.total_warmup_time,
                "total_scan_hr": self.total_scan_time,
                "total_recoating_hr": self.total_recoating_time,
                "total_print_hr": self.total_print_time,
                "total_cooldown_hr": self.total_cooldown_time,
                "total_build_exchange_hr": self.total_build_exchange_time,
                "total_machine_time_hr": self.total_machine_time,
                "cost": self.machine_cost
            },
            "consumables": {
                "inert_gas_cost": self.inert_gas_cost,
                "per_build_consumables": self.per_build_consumables,
                "cost": self.consumables_cost
            },
            "labor": {
                "labor_during_build_hr": self.labor_during_build,
                "labor_build_exchange_hr": self.labor_build_exchange,
                "total_labor_hr": self.total_labor_hours,
                "cost": self.labor_cost
            },
            "post_process": {
                "support_removal_time_hr": self.support_removal_time,
                "cost": self.post_process_cost
            },
            "metal_am_extensions": {
                "heat_treatment_cost": self.heat_treatment_cost,
                "part_separation_cost": self.part_separation_cost,
                "hip_cost": self.hip_cost,
                "surface_treatment_cost": self.surface_treatment_cost,
                "ndt_cost": self.ndt_cost
            },
            "total_cost": self.total_cost,
            "cost_per_part": self.cost_per_part
        }


def calculate_cost(inputs: CostInputs) -> CostBreakdown:
    """
    Main cost calculation function mirroring MIT Excel model formulas.
    """
    # --- Derived part params ---
    support_mass_per_part = inputs.support_pct_of_mass * inputs.part_mass  # kg

    # --- Step 0: Packing / Build Planning ---
    # Effective height = raw part geometry height + elevation gap above build plate.
    effective_height = inputs.part_height + inputs.elevation_cm
    if effective_height > 0 and effective_height > inputs.build_height:
        raise ValueError(
            f"Effective height ({effective_height * 10:.1f} mm = "
            f"{inputs.part_height * 10:.1f} mm part + {inputs.elevation_cm * 10:.1f} mm gap) "
            f"exceeds machine build height ({inputs.build_height * 10:.0f} mm)."
        )

    # For 3D packing: the elevation gap applies only to the bottom of the first layer.
    # Subsequent stacked layers sit directly on top — no additional gap between them.
    # Available height for part stacking = build_height - elevation_cm.
    layers = 1  # number of part layers stacked vertically (only >1 for 3D packing)
    if inputs.parts_per_build_override and inputs.parts_per_build_override > 0:
        parts_per_build = inputs.parts_per_build_override
    else:
        if inputs.packing_policy == "3D" and inputs.part_height > 0:
            available_z = inputs.build_height - inputs.elevation_cm
            layers = max(1, math.floor(available_z / inputs.part_height))
        parts_per_layer = (
            inputs.build_area / inputs.part_projected_area * inputs.packing_fraction
            if inputs.part_projected_area > 0
            else 1
        )
        parts_per_build = max(1, math.floor(layers * parts_per_layer))

    num_builds = math.ceil(inputs.production_run / parts_per_build)

    # Actual Z-extent of powder bed:
    #   elevation gap (once, at bottom) + all stacked part layers above it.
    job_height = inputs.elevation_cm + layers * inputs.part_height

    # --- Cost Category 1: Material ---
    total_part_material = inputs.production_run * inputs.part_mass           # kg
    total_support_material = inputs.production_run * support_mass_per_part   # kg

    # Total powder deposited across all builds — recoater spreads across the full build area
    # for every layer up to job_height (unused chamber above is empty).
    total_build_material = (
        num_builds * inputs.build_area * job_height * inputs.material_density / 1000
    )  # kg

    unfused_powder = max(0.0, total_build_material - total_part_material - total_support_material)
    recycled_material = unfused_powder * inputs.recycling_fraction
    material_waste = unfused_powder - recycled_material
    material_required = material_waste + total_support_material + total_part_material
    material_cost = material_required * inputs.material_cost_per_kg

    # --- Cost Category 2: Build Preparation ---
    build_prep_time = (
        (num_builds - 1) * inputs.subsequent_build_prep_time + inputs.first_build_prep_time
    )
    build_prep_cost = build_prep_time * inputs.salary_engineer

    # --- Cost Category 3: Machine Usage ---
    total_upfront_cost = inputs.machine_cost * (1 + inputs.infrastructure_pct)
    annual_depreciation = (
        inputs.cost_of_capital
        * total_upfront_cost
        / (1 - (1 + inputs.cost_of_capital) ** (-inputs.machine_lifetime))
    )
    annual_maintenance = inputs.maintenance_pct * inputs.machine_cost
    annual_machine_cost = annual_depreciation + annual_maintenance

    operating_hours_per_year = (
        inputs.hours_per_day * inputs.days_per_week * 52 * inputs.uptime
    )
    machine_cost_per_hour = (
        annual_machine_cost / operating_hours_per_year if operating_hours_per_year > 0 else 0
    )

    total_warmup_time = num_builds * inputs.warmup_time

    # Effective build rate scales with number of laser beams engaged
    effective_build_rate = inputs.build_rate * max(1, inputs.laser_multiplier)
    # Laser scans both part and support material; support_pct_of_mass equals support volume fraction
    # (same density), so total scanned volume per part = part_volume × (1 + support_pct_of_mass).
    total_scan_time = (
        inputs.production_run * inputs.part_volume * (1 + inputs.support_pct_of_mass) / effective_build_rate
        if effective_build_rate > 0
        else 0
    )

    # Recoating time — from first principles if distance+speed are set, else efficiency fallback
    if inputs.recoating_distance_mm and inputs.recoating_speed_mm_s and inputs.recoating_speed_mm_s > 0:
        recoat_time_per_layer_hr = inputs.recoating_distance_mm / inputs.recoating_speed_mm_s / 3600
        layer_thickness_cm = inputs.layer_thickness_um / 10000 if inputs.layer_thickness_um > 0 else 0.004
        # job_height covers all stacked layers (3D packing) so recoating traverses the full job Z extent
        num_layers = math.ceil(job_height / layer_thickness_cm) if layer_thickness_cm > 0 else 0
        total_recoating_time = num_builds * num_layers * recoat_time_per_layer_hr
    elif inputs.recoating_efficiency < 1.0 and inputs.recoating_efficiency > 0:
        # efficiency fraction: scan_time / total_active_time
        # → total_active_time = scan_time / efficiency → recoating = scan_time * (1/efficiency - 1)
        total_recoating_time = total_scan_time * (1.0 / inputs.recoating_efficiency - 1.0)
    else:
        total_recoating_time = 0.0

    total_print_time = total_scan_time + total_recoating_time
    total_cooldown_time = num_builds * inputs.cooldown_time
    total_build_exchange_time = num_builds * (
        inputs.setup_time_per_build + inputs.removal_time_per_build
    )
    total_machine_time = (
        total_warmup_time
        + total_print_time
        + total_cooldown_time
        + total_build_exchange_time
    )

    machine_cost = total_machine_time * machine_cost_per_hour

    # --- Cost Category 4: Consumables ---
    build_active_time = total_warmup_time + total_print_time + total_cooldown_time
    inert_gas_cost = inputs.inert_gas_cost * build_active_time
    per_build_consumables = inputs.consumable_cost_per_build * num_builds
    consumables_cost = inert_gas_cost + per_build_consumables

    # --- Cost Category 5: Labor ---
    labor_during_build = build_active_time * inputs.fte_supervised
    labor_build_exchange = total_build_exchange_time * inputs.fte_build_exchange
    total_labor_hours = labor_during_build + labor_build_exchange
    labor_cost = total_labor_hours * inputs.salary_operator

    # --- Cost Category 6: Post-Process (Support Removal) ---
    support_removal_time_per_part = (
        inputs.support_constant * math.sqrt(inputs.part_projected_area)
        if inputs.part_projected_area > 0 and inputs.support_pct_of_mass > 0
        else 0
    )
    support_removal_time = support_removal_time_per_part * inputs.production_run
    post_process_cost = support_removal_time * inputs.salary_technician

    # --- Metal AM Extensions ---
    heat_treatment_cost = (
        inputs.heat_treatment_cost_per_build * num_builds
        if inputs.heat_treatment_enabled
        else 0.0
    )
    part_separation_cost = (
        inputs.part_separation_cost_per_part * inputs.production_run
        if inputs.part_separation_enabled
        else 0.0
    )
    hip_cost = (
        inputs.hip_cost_per_part * inputs.production_run
        if inputs.hip_enabled
        else 0.0
    )
    surface_treatment_cost = (
        inputs.surface_treatment_cost_per_part * inputs.production_run
        if inputs.surface_treatment_enabled
        else 0.0
    )
    ndt_cost = (
        inputs.ndt_cost_per_part * inputs.production_run
        if inputs.ndt_enabled
        else 0.0
    )

    # --- Totals ---
    total_cost = (
        material_cost
        + build_prep_cost
        + machine_cost
        + consumables_cost
        + labor_cost
        + post_process_cost
        + heat_treatment_cost
        + part_separation_cost
        + hip_cost
        + surface_treatment_cost
        + ndt_cost
    )
    cost_per_part = total_cost / inputs.production_run if inputs.production_run > 0 else 0

    return CostBreakdown(
        parts_per_build=parts_per_build,
        num_builds=num_builds,
        support_mass_per_part=support_mass_per_part,
        total_part_material=total_part_material,
        total_support_material=total_support_material,
        total_build_material=total_build_material,
        recycled_material=recycled_material,
        material_waste=material_waste,
        material_required=material_required,
        material_cost=material_cost,
        build_prep_time=build_prep_time,
        build_prep_cost=build_prep_cost,
        annual_depreciation=annual_depreciation,
        annual_maintenance=annual_maintenance,
        annual_machine_cost=annual_machine_cost,
        operating_hours_per_year=operating_hours_per_year,
        machine_cost_per_hour=machine_cost_per_hour,
        total_warmup_time=total_warmup_time,
        total_scan_time=total_scan_time,
        total_recoating_time=total_recoating_time,
        total_print_time=total_print_time,
        total_cooldown_time=total_cooldown_time,
        total_build_exchange_time=total_build_exchange_time,
        total_machine_time=total_machine_time,
        machine_cost=machine_cost,
        inert_gas_cost=inert_gas_cost,
        per_build_consumables=per_build_consumables,
        consumables_cost=consumables_cost,
        labor_during_build=labor_during_build,
        labor_build_exchange=labor_build_exchange,
        total_labor_hours=total_labor_hours,
        labor_cost=labor_cost,
        support_removal_time=support_removal_time,
        post_process_cost=post_process_cost,
        heat_treatment_cost=heat_treatment_cost,
        part_separation_cost=part_separation_cost,
        hip_cost=hip_cost,
        surface_treatment_cost=surface_treatment_cost,
        ndt_cost=ndt_cost,
        total_cost=total_cost,
        cost_per_part=cost_per_part
    )


def calculate_quantity_curve(inputs: CostInputs, max_quantity: int = 500) -> list:
    """Generate cost-per-part data for different production quantities."""
    results = []
    # Generate points on a log scale for better visualization
    quantities = []
    q = 1
    while q <= max_quantity:
        quantities.append(q)
        if q < 10:
            q += 1
        elif q < 50:
            q += 5
        elif q < 100:
            q += 10
        elif q < 200:
            q += 25
        else:
            q += 50

    for qty in quantities:
        inp = CostInputs(**{**inputs.__dict__, 'production_run': qty})
        result = calculate_cost(inp)
        results.append({
            "quantity": qty,
            "cost_per_part": result.cost_per_part,
            "total_cost": result.total_cost,
            "material_cost": result.material_cost / qty,
            "machine_cost": result.machine_cost / qty,
            "labor_cost": result.labor_cost / qty,
            "consumables_cost": result.consumables_cost / qty,
            "build_prep_cost": result.build_prep_cost / qty,
            "post_process_cost": result.post_process_cost / qty,
            "parts_per_build": result.parts_per_build,
            "num_builds": result.num_builds
        })
    return results
