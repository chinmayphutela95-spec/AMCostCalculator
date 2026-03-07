from database import Base
from sqlalchemy import Column, Integer, Float, String, Boolean, Text, DateTime
from datetime import datetime


class Machine(Base):
    __tablename__ = "machines"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    manufacturer = Column(String, default="")
    process_type = Column(String, default="LPBF")  # LPBF, EBPBF, DED, BJ
    build_plate_shape = Column(String, default="rectangular")  # circular, rectangular
    # Build volume
    build_plate_diameter = Column(Float, nullable=True)   # cm (for circular)
    build_plate_width = Column(Float, nullable=True)      # cm (for rectangular)
    build_plate_length = Column(Float, nullable=True)     # cm (for rectangular)
    build_height = Column(Float, default=25.0)            # cm
    build_area = Column(Float, default=490.87)            # cm²
    build_rate = Column(Float, default=10.0)              # cm³/hr fallback (overridden by material)
    num_lasers = Column(Integer, default=1)               # number of laser beams
    # Machine economics
    machine_cost = Column(Float, default=500000.0)        # $
    machine_lifetime = Column(Float, default=7.0)         # years
    cost_of_capital = Column(Float, default=0.05)         # fraction (5%)
    infrastructure_pct = Column(Float, default=0.50)      # fraction (50%)
    maintenance_pct = Column(Float, default=0.05)         # fraction (5%)
    uptime = Column(Float, default=0.80)                  # fraction (80%)
    # Packing
    packing_policy = Column(String, default="2D")         # 2D, 3D
    packing_fraction = Column(Float, default=0.90)        # fraction
    recycling_fraction = Column(Float, default=0.90)      # fraction
    # Consumables
    inert_gas_cost = Column(Float, default=20.0)          # $/hr
    consumable_cost_per_build = Column(Float, default=100.0)  # $
    # Time parameters
    first_build_prep_time = Column(Float, default=3.0)        # hr
    subsequent_build_prep_time = Column(Float, default=0.0)   # hr
    setup_time_per_build = Column(Float, default=1.0)         # hr
    removal_time_per_build = Column(Float, default=1.0)       # hr
    warmup_time = Column(Float, default=1.0)                  # hr
    cooldown_time = Column(Float, default=2.0)                # hr
    support_constant = Column(Float, default=0.11)
    # Operations
    hours_per_day = Column(Float, default=18.0)
    days_per_week = Column(Float, default=5.0)
    fte_supervised = Column(Float, default=0.15)
    fte_build_exchange = Column(Float, default=1.0)
    fte_support_removal = Column(Float, default=1.0)
    salary_engineer = Column(Float, default=70.0)     # $/hr
    salary_operator = Column(Float, default=50.0)     # $/hr
    salary_technician = Column(Float, default=30.0)   # $/hr
    is_custom = Column(Boolean, default=False)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class Material(Base):
    __tablename__ = "materials"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    alloy_designation = Column(String, default="")
    category = Column(String, default="Steel")  # Steel, Titanium, Aluminum, Nickel, Cobalt, Copper
    process_compatibility = Column(String, default="LPBF")  # comma-separated
    cost_per_kg = Column(Float, default=50.0)   # $/kg
    density = Column(Float, default=8.0)        # g/cm³
    # Process parameters (material-specific)
    layer_thickness_um = Column(Float, default=40.0)    # µm (typical layer thickness for LPBF)
    build_rate_cm3_hr = Column(Float, default=10.0)     # cm³/hr (single-laser build rate for this material)
    # Mechanical properties
    yield_strength = Column(Float, nullable=True)      # MPa
    tensile_strength = Column(Float, nullable=True)    # MPa
    elongation = Column(Float, nullable=True)          # %
    hardness = Column(Float, nullable=True)            # HV
    max_service_temp = Column(Float, nullable=True)    # °C
    is_custom = Column(Boolean, default=False)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    part_file_name = Column(String, nullable=True)
    inputs_json = Column(Text, default="{}")
    results_json = Column(Text, default="{}")
    ai_insights_json = Column(Text, default="{}")


class Settings(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True)
    value = Column(Text, default="")
