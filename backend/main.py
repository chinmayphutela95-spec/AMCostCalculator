from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import os
import json
import uuid
import shutil
from datetime import datetime

from sqlalchemy import text
from database import engine, get_db, Base
import models
from cost_calculator import CostInputs, calculate_cost, calculate_quantity_curve
from geometry_parser import parse_stl, compute_mass
from ai_insights import get_ai_insights
from export_service import export_to_excel, export_to_pdf

# Create all tables
Base.metadata.create_all(bind=engine)

# ── Schema migrations (adds new columns to existing DBs) ──────────────────────
def _run_migrations():
    stmts = [
        "ALTER TABLE machines ADD COLUMN num_lasers INTEGER DEFAULT 1",
        "ALTER TABLE machines ADD COLUMN recoating_distance_mm REAL",
        "ALTER TABLE machines ADD COLUMN recoating_speed_mm_s REAL",
        "ALTER TABLE materials ADD COLUMN layer_thickness_um REAL DEFAULT 40.0",
        "ALTER TABLE materials ADD COLUMN build_rate_cm3_hr REAL DEFAULT 10.0",
    ]
    with engine.connect() as conn:
        for stmt in stmts:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass  # column already exists

_run_migrations()

app = FastAPI(title="Metal AM Cost Analyzer", version="1.0.0")

# CORS for local frontend dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

EXPORT_DIR = os.path.join(os.path.dirname(__file__), "exports")
os.makedirs(EXPORT_DIR, exist_ok=True)


# ============================================================
# Pydantic Schemas
# ============================================================

class MachineCreate(BaseModel):
    name: str
    manufacturer: str = ""
    process_type: str = "LPBF"
    build_plate_shape: str = "rectangular"
    build_plate_diameter: Optional[float] = None
    build_plate_width: Optional[float] = None
    build_plate_length: Optional[float] = None
    build_height: float = 25.0
    build_area: float = 490.87
    build_rate: float = 10.0           # fallback build rate (cm³/hr)
    num_lasers: int = 1                # number of laser beams in the machine
    recoating_distance_mm: Optional[float] = None  # full chamber travel length (mm)
    recoating_speed_mm_s: Optional[float] = None   # average recoater speed (mm/s)
    machine_cost: float = 500000.0
    machine_lifetime: float = 7.0
    cost_of_capital: float = 0.05
    infrastructure_pct: float = 0.50
    maintenance_pct: float = 0.05
    uptime: float = 0.80
    packing_policy: str = "2D"
    packing_fraction: float = 0.90
    recycling_fraction: float = 0.90
    inert_gas_cost: float = 20.0
    consumable_cost_per_build: float = 100.0
    first_build_prep_time: float = 3.0
    subsequent_build_prep_time: float = 0.0
    setup_time_per_build: float = 1.0
    removal_time_per_build: float = 1.0
    warmup_time: float = 1.0
    cooldown_time: float = 2.0
    support_constant: float = 0.11
    hours_per_day: float = 18.0
    days_per_week: float = 5.0
    fte_supervised: float = 0.15
    fte_build_exchange: float = 1.0
    fte_support_removal: float = 1.0
    salary_engineer: float = 70.0
    salary_operator: float = 50.0
    salary_technician: float = 30.0
    notes: str = ""


class MaterialCreate(BaseModel):
    name: str
    alloy_designation: str = ""
    category: str = "Steel"
    process_compatibility: str = "LPBF"
    cost_per_kg: float = 50.0
    density: float = 8.0
    layer_thickness_um: float = 40.0       # typical LPBF layer thickness in µm
    build_rate_cm3_hr: float = 10.0        # single-laser build rate for this material
    yield_strength: Optional[float] = None
    tensile_strength: Optional[float] = None
    elongation: Optional[float] = None
    hardness: Optional[float] = None
    max_service_temp: Optional[float] = None
    notes: str = ""


class AnalysisRequest(BaseModel):
    # Part
    part_mass: float
    part_volume: float
    part_height: float
    elevation_mm: float = 0.0      # height of part bottom above build plate (mm)
    part_projected_area: float
    support_pct_of_mass: float = 0.15
    # Production
    production_run: int = 100
    # Machine (by id or direct params)
    machine_id: Optional[int] = None
    # Material (by id or direct params)
    material_id: Optional[int] = None
    material_cost_per_kg: Optional[float] = None
    material_density: Optional[float] = None
    # Material process parameters (from material record, overrideable)
    material_build_rate: Optional[float] = None   # cm³/hr — from material; falls back to machine build_rate
    layer_thickness_um: Optional[float] = None    # µm — informational
    # Multi-laser configuration
    laser_strategy: str = "single"   # "single" | "multi_per_part" | "multi_zones"
    lasers_per_part: int = 1         # how many lasers to engage (capped to machine.num_lasers)
    # Recoating
    recoating_efficiency: float = 1.0  # fallback fraction (1.0 = no overhead; 0.75 = 33% overhead)
    # Packing override
    parts_per_build_override: Optional[int] = None  # user-supplied override; bypasses auto packing calc
    # Overrides (optional - will use machine defaults if not provided)
    inert_gas_cost: Optional[float] = None
    consumable_cost_per_build: Optional[float] = None
    hours_per_day: Optional[float] = None
    days_per_week: Optional[float] = None
    salary_engineer: Optional[float] = None
    salary_operator: Optional[float] = None
    salary_technician: Optional[float] = None
    # Metal AM extensions
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


class ProjectSave(BaseModel):
    name: str
    description: str = ""
    part_file_name: Optional[str] = None
    inputs_json: str = "{}"
    results_json: str = "{}"
    ai_insights_json: str = "{}"


class CompareRequest(BaseModel):
    machine_ids: List[int]
    part_mass: float
    part_volume: float
    part_height: float
    elevation_mm: float = 0.0      # height of part bottom above build plate (mm)
    part_projected_area: float
    support_pct_of_mass: float = 0.15
    production_run: int = 100
    material_cost_per_kg: float = 50.0
    material_density: float = 8.0
    heat_treatment_enabled: bool = False
    heat_treatment_cost_per_build: float = 0.0
    part_separation_enabled: bool = False
    part_separation_cost_per_part: float = 0.0


# ============================================================
# Helper
# ============================================================

def machine_to_cost_inputs(machine: models.Machine, req: AnalysisRequest) -> CostInputs:
    """Convert a Machine DB model + request to CostInputs."""
    # Build rate: prefer material-specific value; fall back to machine default
    build_rate = req.material_build_rate if req.material_build_rate else machine.build_rate

    # Laser multiplier: clamp to machine's physical laser count
    num_lasers = getattr(machine, 'num_lasers', 1) or 1
    if req.laser_strategy in ("multi_per_part", "multi_zones"):
        laser_multiplier = min(max(1, req.lasers_per_part), num_lasers)
    else:
        laser_multiplier = 1

    return CostInputs(
        part_mass=req.part_mass,
        part_volume=req.part_volume,
        part_height=req.part_height,                              # raw geometry height (no elevation)
        elevation_cm=getattr(req, 'elevation_mm', 0.0) / 10.0,  # kept separate so 3D packing is correct
        part_projected_area=req.part_projected_area,
        support_pct_of_mass=req.support_pct_of_mass,
        production_run=req.production_run,
        layer_thickness_um=req.layer_thickness_um or 40.0,
        recoating_distance_mm=getattr(machine, 'recoating_distance_mm', None),
        recoating_speed_mm_s=getattr(machine, 'recoating_speed_mm_s', None),
        recoating_efficiency=req.recoating_efficiency,
        parts_per_build_override=req.parts_per_build_override,
        machine_cost=machine.machine_cost,
        machine_lifetime=machine.machine_lifetime,
        cost_of_capital=machine.cost_of_capital,
        infrastructure_pct=machine.infrastructure_pct,
        maintenance_pct=machine.maintenance_pct,
        build_area=machine.build_area,
        build_height=machine.build_height,
        build_rate=build_rate,
        laser_multiplier=laser_multiplier,
        uptime=machine.uptime,
        packing_policy=machine.packing_policy,
        packing_fraction=machine.packing_fraction,
        recycling_fraction=machine.recycling_fraction,
        material_cost_per_kg=req.material_cost_per_kg or 50.0,
        material_density=req.material_density or 8.0,
        inert_gas_cost=(
            req.inert_gas_cost
            if req.inert_gas_cost is not None
            else machine.inert_gas_cost
        ),
        consumable_cost_per_build=(
            req.consumable_cost_per_build
            if req.consumable_cost_per_build is not None
            else machine.consumable_cost_per_build
        ),
        first_build_prep_time=machine.first_build_prep_time,
        subsequent_build_prep_time=machine.subsequent_build_prep_time,
        setup_time_per_build=machine.setup_time_per_build,
        removal_time_per_build=machine.removal_time_per_build,
        warmup_time=machine.warmup_time,
        cooldown_time=machine.cooldown_time,
        support_constant=machine.support_constant,
        hours_per_day=(
            req.hours_per_day
            if req.hours_per_day is not None
            else machine.hours_per_day
        ),
        days_per_week=(
            req.days_per_week
            if req.days_per_week is not None
            else machine.days_per_week
        ),
        fte_supervised=machine.fte_supervised,
        fte_build_exchange=machine.fte_build_exchange,
        fte_support_removal=machine.fte_support_removal,
        salary_engineer=(
            req.salary_engineer
            if req.salary_engineer is not None
            else machine.salary_engineer
        ),
        salary_operator=(
            req.salary_operator
            if req.salary_operator is not None
            else machine.salary_operator
        ),
        salary_technician=(
            req.salary_technician
            if req.salary_technician is not None
            else machine.salary_technician
        ),
        heat_treatment_enabled=req.heat_treatment_enabled,
        heat_treatment_cost_per_build=req.heat_treatment_cost_per_build,
        part_separation_enabled=req.part_separation_enabled,
        part_separation_cost_per_part=req.part_separation_cost_per_part,
        hip_enabled=req.hip_enabled,
        hip_cost_per_part=req.hip_cost_per_part,
        surface_treatment_enabled=req.surface_treatment_enabled,
        surface_treatment_cost_per_part=req.surface_treatment_cost_per_part,
        ndt_enabled=req.ndt_enabled,
        ndt_cost_per_part=req.ndt_cost_per_part,
    )


# ============================================================
# Machine Routes
# ============================================================

@app.get("/api/machines")
def list_machines(db: Session = Depends(get_db)):
    return db.query(models.Machine).all()


@app.get("/api/machines/{machine_id}")
def get_machine(machine_id: int, db: Session = Depends(get_db)):
    m = db.query(models.Machine).filter(models.Machine.id == machine_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Machine not found")
    return m


@app.post("/api/machines")
def create_machine(machine: MachineCreate, db: Session = Depends(get_db)):
    db_machine = models.Machine(**machine.dict(), is_custom=True)
    db.add(db_machine)
    db.commit()
    db.refresh(db_machine)
    return db_machine


@app.put("/api/machines/{machine_id}")
def update_machine(machine_id: int, machine: MachineCreate, db: Session = Depends(get_db)):
    db_machine = db.query(models.Machine).filter(models.Machine.id == machine_id).first()
    if not db_machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    for key, value in machine.dict().items():
        setattr(db_machine, key, value)
    db.commit()
    db.refresh(db_machine)
    return db_machine


@app.delete("/api/machines/{machine_id}")
def delete_machine(machine_id: int, db: Session = Depends(get_db)):
    db_machine = db.query(models.Machine).filter(models.Machine.id == machine_id).first()
    if not db_machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    db.delete(db_machine)
    db.commit()
    return {"ok": True}


# ============================================================
# Material Routes
# ============================================================

@app.get("/api/materials")
def list_materials(db: Session = Depends(get_db)):
    return db.query(models.Material).all()


@app.get("/api/materials/{material_id}")
def get_material(material_id: int, db: Session = Depends(get_db)):
    m = db.query(models.Material).filter(models.Material.id == material_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Material not found")
    return m


@app.post("/api/materials")
def create_material(material: MaterialCreate, db: Session = Depends(get_db)):
    db_material = models.Material(**material.dict(), is_custom=True)
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    return db_material


@app.put("/api/materials/{material_id}")
def update_material(material_id: int, material: MaterialCreate, db: Session = Depends(get_db)):
    db_material = db.query(models.Material).filter(models.Material.id == material_id).first()
    if not db_material:
        raise HTTPException(status_code=404, detail="Material not found")
    for key, value in material.dict().items():
        setattr(db_material, key, value)
    db.commit()
    db.refresh(db_material)
    return db_material


@app.delete("/api/materials/{material_id}")
def delete_material(material_id: int, db: Session = Depends(get_db)):
    db_material = db.query(models.Material).filter(models.Material.id == material_id).first()
    if not db_material:
        raise HTTPException(status_code=404, detail="Material not found")
    db.delete(db_material)
    db.commit()
    return {"ok": True}


# ============================================================
# Geometry / STL Upload
# ============================================================

@app.post("/api/geometry/parse")
async def parse_geometry(
    file: UploadFile = File(...),
    build_direction: str = Form(default="z"),
    overhang_angle: float = Form(default=45.0),
    fill_density: float = Form(default=0.3),
):
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in ['.stl', '.step', '.stp', '.obj']:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Use STL, STEP, or OBJ."
        )

    file_id = str(uuid.uuid4())
    save_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_ext}")

    with open(save_path, "wb") as f:
        content = await file.read()
        f.write(content)

    result = parse_stl(save_path, build_direction, overhang_angle, fill_density)
    result["file_id"] = file_id
    result["file_name"] = file.filename
    result["file_path"] = save_path

    return result


@app.post("/api/geometry/reanalyze")
async def reanalyze_geometry(
    file_path: str = Form(...),
    build_direction: str = Form(default="z"),
    overhang_angle: float = Form(default=45.0),
    fill_density: float = Form(default=0.3),
):
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found. Please re-upload the STL.")
    return parse_stl(file_path, build_direction, overhang_angle, fill_density)


# ============================================================
# Analysis Routes
# ============================================================

@app.post("/api/analysis/calculate")
def calculate(req: AnalysisRequest, db: Session = Depends(get_db)):
    if req.machine_id:
        machine = db.query(models.Machine).filter(models.Machine.id == req.machine_id).first()
        if not machine:
            raise HTTPException(status_code=404, detail="Machine not found")
    else:
        raise HTTPException(status_code=400, detail="machine_id is required")

    if req.material_id:
        material = db.query(models.Material).filter(models.Material.id == req.material_id).first()
        if material:
            req.material_cost_per_kg = req.material_cost_per_kg or material.cost_per_kg
            req.material_density = req.material_density or material.density
            # Use material's build rate unless the caller already specified one
            if req.material_build_rate is None:
                req.material_build_rate = getattr(material, 'build_rate_cm3_hr', None)

    try:
        inputs = machine_to_cost_inputs(machine, req)
        result = calculate_cost(inputs)
        curve = calculate_quantity_curve(inputs)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return {
        "result": result.to_dict(),
        "quantity_curve": curve,
        "machine_name": machine.name
    }


@app.post("/api/analysis/compare")
def compare_machines(req: CompareRequest, db: Session = Depends(get_db)):
    if not req.machine_ids:
        raise HTTPException(status_code=400, detail="At least one machine_id required")

    comparisons = []
    for machine_id in req.machine_ids:
        machine = db.query(models.Machine).filter(models.Machine.id == machine_id).first()
        if not machine:
            continue

        inputs = CostInputs(
            part_mass=req.part_mass,
            part_volume=req.part_volume,
            part_height=req.part_height,              # raw geometry height
            elevation_cm=req.elevation_mm / 10.0,    # kept separate for correct 3D packing
            part_projected_area=req.part_projected_area,
            support_pct_of_mass=req.support_pct_of_mass,
            production_run=req.production_run,
            machine_cost=machine.machine_cost,
            machine_lifetime=machine.machine_lifetime,
            cost_of_capital=machine.cost_of_capital,
            infrastructure_pct=machine.infrastructure_pct,
            maintenance_pct=machine.maintenance_pct,
            build_area=machine.build_area,
            build_height=machine.build_height,
            build_rate=machine.build_rate,
            uptime=machine.uptime,
            packing_policy=machine.packing_policy,
            packing_fraction=machine.packing_fraction,
            recycling_fraction=machine.recycling_fraction,
            material_cost_per_kg=req.material_cost_per_kg,
            material_density=req.material_density,
            inert_gas_cost=machine.inert_gas_cost,
            consumable_cost_per_build=machine.consumable_cost_per_build,
            first_build_prep_time=machine.first_build_prep_time,
            subsequent_build_prep_time=machine.subsequent_build_prep_time,
            setup_time_per_build=machine.setup_time_per_build,
            removal_time_per_build=machine.removal_time_per_build,
            warmup_time=machine.warmup_time,
            cooldown_time=machine.cooldown_time,
            support_constant=machine.support_constant,
            hours_per_day=machine.hours_per_day,
            days_per_week=machine.days_per_week,
            fte_supervised=machine.fte_supervised,
            fte_build_exchange=machine.fte_build_exchange,
            fte_support_removal=machine.fte_support_removal,
            salary_engineer=machine.salary_engineer,
            salary_operator=machine.salary_operator,
            salary_technician=machine.salary_technician,
            heat_treatment_enabled=req.heat_treatment_enabled,
            heat_treatment_cost_per_build=req.heat_treatment_cost_per_build,
            part_separation_enabled=req.part_separation_enabled,
            part_separation_cost_per_part=req.part_separation_cost_per_part,
        )

        result = calculate_cost(inputs)
        curve = calculate_quantity_curve(inputs, max_quantity=200)

        comparisons.append({
            "machine_id": machine_id,
            "machine_name": machine.name,
            "manufacturer": machine.manufacturer,
            "result": result.to_dict(),
            "quantity_curve": curve
        })

    return {"comparisons": comparisons}


# ============================================================
# Projects Routes
# ============================================================

@app.get("/api/projects")
def list_projects(db: Session = Depends(get_db)):
    return db.query(models.Project).order_by(models.Project.created_at.desc()).all()


@app.post("/api/projects")
def save_project(project: ProjectSave, db: Session = Depends(get_db)):
    db_project = models.Project(
        name=project.name,
        description=project.description,
        part_file_name=project.part_file_name,
        inputs_json=project.inputs_json,
        results_json=project.results_json,
        ai_insights_json=project.ai_insights_json
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


@app.get("/api/projects/{project_id}")
def get_project(project_id: int, db: Session = Depends(get_db)):
    p = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    p = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(p)
    db.commit()
    return {"ok": True}


# ============================================================
# AI Insights
# ============================================================

class AIInsightsRequest(BaseModel):
    part_info: dict
    cost_breakdown: dict
    material_name: str
    machine_name: str


@app.post("/api/ai/insights")
def ai_insights_endpoint(req: AIInsightsRequest, db: Session = Depends(get_db)):
    setting = db.query(models.Settings).filter(models.Settings.key == "claude_api_key").first()
    api_key = setting.value if setting else None

    result = get_ai_insights(
        part_info=req.part_info,
        material_name=req.material_name,
        machine_name=req.machine_name,
        cost_breakdown=req.cost_breakdown,
        api_key=api_key
    )
    return result


@app.post("/api/ai/analyze")
def ai_analyze(req: AIInsightsRequest, db: Session = Depends(get_db)):
    setting = db.query(models.Settings).filter(models.Settings.key == "claude_api_key").first()
    api_key = setting.value if setting else None

    result = get_ai_insights(
        part_info=req.part_info,
        material_name=req.material_name,
        machine_name=req.machine_name,
        cost_breakdown=req.cost_breakdown,
        api_key=api_key
    )
    return result


# ============================================================
# Export Routes
# ============================================================

class ExportRequest(BaseModel):
    project_name: str
    inputs: dict
    results: dict
    format: str = "excel"  # "excel" or "pdf"
    quantity_curve: Optional[list] = None


def _do_export(project_name: str, inputs: dict, results: dict, fmt: str, quantity_curve=None):
    from fastapi.responses import FileResponse
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in project_name)

    if fmt == "pdf":
        output_path = os.path.join(EXPORT_DIR, f"{safe_name}_{timestamp}.pdf")
        export_to_pdf(project_name, inputs, results, output_path, quantity_curve=quantity_curve)
        return FileResponse(output_path, media_type="application/pdf", filename=f"{safe_name}.pdf")
    else:
        output_path = os.path.join(EXPORT_DIR, f"{safe_name}_{timestamp}.xlsx")
        export_to_excel(project_name, inputs, results, output_path, quantity_curve=quantity_curve)
        return FileResponse(
            output_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=f"{safe_name}.xlsx",
        )


@app.post("/api/export")
def export_report(req: ExportRequest):
    return _do_export(req.project_name, req.inputs, req.results, req.format, req.quantity_curve)


@app.get("/api/projects/{project_id}/export")
def export_project(project_id: int, format: str = "excel", db: Session = Depends(get_db)):
    p = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        inputs  = json.loads(p.inputs_json  or "{}")
        results = json.loads(p.results_json or "{}")
        quantity_curve = inputs.pop("quantity_curve", None)
    except Exception:
        inputs, results, quantity_curve = {}, {}, None
    return _do_export(p.name, inputs, results, format, quantity_curve)


# ============================================================
# Settings Routes
# ============================================================

class SettingUpdate(BaseModel):
    key: str
    value: str


@app.get("/api/settings")
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(models.Settings).all()
    return {s.key: s.value for s in settings}


@app.post("/api/settings")
def update_setting(setting: SettingUpdate, db: Session = Depends(get_db)):
    db_setting = db.query(models.Settings).filter(
        models.Settings.key == setting.key
    ).first()
    if db_setting:
        db_setting.value = setting.value
    else:
        db_setting = models.Settings(key=setting.key, value=setting.value)
        db.add(db_setting)
    db.commit()
    return {"ok": True}
