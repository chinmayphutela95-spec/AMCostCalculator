import os
from datetime import datetime
from typing import Optional


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _c(v) -> str:
    """Format as currency."""
    try:
        return f"${float(v):,.2f}"
    except (TypeError, ValueError):
        return "–"


def _pct(v, total) -> str:
    """Format as % of total."""
    try:
        if total and float(total) > 0:
            return f"{float(v) / float(total) * 100:.1f}%"
        return "0%"
    except (TypeError, ValueError):
        return "–"


def _f(v, decimals=2, suffix="") -> str:
    """Format a numeric value."""
    try:
        return f"{round(float(v), decimals):,}{suffix}"
    except (TypeError, ValueError):
        return str(v) if v is not None else "–"


# ─── Excel ────────────────────────────────────────────────────────────────────

def export_to_excel(
    project_name: str,
    inputs: dict,
    results: dict,
    output_path: str,
    quantity_curve: Optional[list] = None,
) -> str:
    """Multi-sheet Excel report: Summary, Cost Breakdown, Machine & Process, Material & Part, Quantity Curve."""
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter

        wb = Workbook()

        # ── Palette ────────────────────────────────────────────────────────────
        NAVY        = "1B2A4A"
        BLUE        = "1E40AF"
        CYAN_LIGHT  = "CFFAFE"
        WHITE       = "FFFFFF"
        GREY        = "F8FAFC"
        ALT         = "EFF6FF"

        def _hdr_font():   return Font(name="Calibri", bold=True, color=WHITE, size=10)
        def _title_font(): return Font(name="Calibri", bold=True, color=NAVY, size=14)
        def _bold():       return Font(name="Calibri", bold=True, size=10)
        def _normal():     return Font(name="Calibri", size=10)
        def _muted():      return Font(name="Calibri", color="6B7280", size=9)

        def _hdr_fill():  return PatternFill("solid", fgColor=BLUE)
        def _sub_fill():  return PatternFill("solid", fgColor=CYAN_LIGHT)
        def _alt_fill():  return PatternFill("solid", fgColor=ALT)
        def _grey_fill(): return PatternFill("solid", fgColor=GREY)
        def _white_fill():return PatternFill("solid", fgColor=WHITE)
        def _navy_fill(): return PatternFill("solid", fgColor=NAVY)

        _side = Side(style="thin", color="D1D5DB")
        _border = Border(left=_side, right=_side, top=_side, bottom=_side)
        _center = Alignment(horizontal="center", vertical="center", wrap_text=True)
        _right  = Alignment(horizontal="right",  vertical="center")
        _left   = Alignment(horizontal="left",   vertical="center")

        def style_hdr(ws, row, ncols, fill=None):
            for c in range(1, ncols + 1):
                cell = ws.cell(row=row, column=c)
                cell.font   = _hdr_font()
                cell.fill   = fill or _hdr_fill()
                cell.alignment = _center
                cell.border = _border

        def style_row(ws, row, ncols, alt=False):
            fill = _alt_fill() if alt else _white_fill()
            for c in range(1, ncols + 1):
                cell = ws.cell(row=row, column=c)
                cell.fill   = fill
                cell.border = _border
                cell.alignment = _right if c > 1 else _left
                cell.font   = _normal()

        def write_section(ws, row, text, ncols=2):
            cell = ws.cell(row=row, column=1, value=text)
            cell.font  = _bold()
            cell.fill  = _sub_fill()
            cell.alignment = _left
            cell.border = _border
            for c in range(2, ncols + 1):
                ws.cell(row=row, column=c).fill  = _sub_fill()
                ws.cell(row=row, column=c).border = _border
            return row + 1

        def kv_rows(ws, start_row, pairs, alt_start=0, ncols=2):
            """Write (label, value) pairs, return next row."""
            r = start_row
            for i, (label, value) in enumerate(pairs):
                ws.cell(row=r, column=1, value=label)
                ws.cell(row=r, column=2, value=value)
                style_row(ws, r, ncols, alt=(i + alt_start) % 2 == 1)
                r += 1
            return r + 1

        total     = results.get("total_cost", 0) or 1
        cpp       = results.get("cost_per_part", 0) or 0
        prod_run  = inputs.get("production_run", 1) or 1

        categories = [
            ("Material",                results.get("material",         {}).get("cost", 0)),
            ("Build Preparation",       results.get("build_prep",       {}).get("cost", 0)),
            ("Machine Usage",           results.get("machine",          {}).get("cost", 0)),
            ("Consumables",             results.get("consumables",      {}).get("cost", 0)),
            ("Labor",                   results.get("labor",            {}).get("cost", 0)),
            ("Post-Process (Support)",  results.get("post_process",     {}).get("cost", 0)),
            ("Heat Treatment",          results.get("metal_am_extensions", {}).get("heat_treatment_cost", 0)),
            ("Part Separation",         results.get("metal_am_extensions", {}).get("part_separation_cost", 0)),
            ("HIP",                     results.get("metal_am_extensions", {}).get("hip_cost", 0)),
            ("Surface Treatment",       results.get("metal_am_extensions", {}).get("surface_treatment_cost", 0)),
            ("NDT / Inspection",        results.get("metal_am_extensions", {}).get("ndt_cost", 0)),
        ]

        # ══════════════════════════════════════════════════════════════════════
        # SHEET 1 — Summary
        # ══════════════════════════════════════════════════════════════════════
        ws1 = wb.active
        ws1.title = "Summary"

        ws1["A1"] = "Metal AM Cost Analysis Report"
        ws1["A1"].font = _title_font()
        ws1["A2"] = f"Project: {project_name}"
        ws1["A2"].font = _bold()
        ws1["A3"] = f"Generated: {datetime.now().strftime('%B %d, %Y  %H:%M')}"
        ws1["A3"].font = _muted()
        machine_name  = inputs.get("machine_name",   inputs.get("machine",   "–"))
        material_name = inputs.get("material_name",  inputs.get("material",  "–"))
        ws1["A4"] = f"Machine: {machine_name}   ·   Material: {material_name}"
        ws1["A4"].font = Font(name="Calibri", color="374151", size=10)

        r = 6
        for col, h in enumerate(["Metric", "Value"], 1):
            ws1.cell(row=r, column=col, value=h)
        style_hdr(ws1, r, 2)
        r += 1

        summary_kv = [
            ("Cost per Part",       _c(cpp)),
            ("Total Run Cost",      _c(total)),
            ("Production Run",      f"{prod_run:,} parts"),
            ("Parts per Build",     str(results.get("parts_per_build", "–"))),
            ("Number of Builds",    str(results.get("num_builds", "–"))),
            ("Part Volume",         _f(inputs.get("part_volume_cm3"), 3, " cm³")),
            ("Part Height",         _f((inputs.get("part_height_cm") or 0) * 10, 1, " mm")),
            ("Part Mass",           _f(inputs.get("part_mass_kg"), 4, " kg")),
            ("Support Fraction",    _f((inputs.get("support_pct_of_mass") or 0) * 100, 1, "%")),
            ("Build Direction",     (inputs.get("build_direction") or "–").upper()),
        ]
        r = kv_rows(ws1, r, summary_kv, ncols=2)

        # Mini cost breakdown on summary sheet
        r = write_section(ws1, r, "Cost by Category", ncols=4)
        for col, h in enumerate(["Category", "Cost ($)", "Cost/Part ($)", "% of Total"], 1):
            ws1.cell(row=r, column=col, value=h)
        style_hdr(ws1, r, 4)
        r += 1

        for i, (cat, cost) in enumerate(categories):
            if cost == 0:
                continue
            ws1.cell(row=r, column=1, value=cat)
            ws1.cell(row=r, column=2, value=round(cost, 2))
            ws1.cell(row=r, column=2).number_format = "$#,##0.00"
            ws1.cell(row=r, column=3, value=round(cost / prod_run, 2))
            ws1.cell(row=r, column=3).number_format = "$#,##0.00"
            ws1.cell(row=r, column=4, value=_pct(cost, total))
            style_row(ws1, r, 4, alt=i % 2 == 1)
            r += 1

        # Total row
        for c, v in enumerate(["TOTAL", round(total, 2), round(cpp, 2), "100%"], 1):
            cell = ws1.cell(row=r, column=c, value=v)
            cell.font  = Font(name="Calibri", bold=True, color=WHITE, size=10)
            cell.fill  = _navy_fill()
            cell.border = _border
            cell.alignment = _right if c > 1 else _left
            if c in (2, 3):
                cell.number_format = "$#,##0.00"

        ws1.column_dimensions["A"].width = 30
        ws1.column_dimensions["B"].width = 18
        ws1.column_dimensions["C"].width = 16
        ws1.column_dimensions["D"].width = 13

        # ══════════════════════════════════════════════════════════════════════
        # SHEET 2 — Detailed Cost Breakdown
        # ══════════════════════════════════════════════════════════════════════
        ws2 = wb.create_sheet("Cost Breakdown")
        ws2["A1"] = "Detailed Cost Breakdown"
        ws2["A1"].font = _title_font()
        ws2["A2"] = project_name
        ws2["A2"].font = _muted()

        r2 = 4

        def breakdown_section(ws, r, title, rows):
            """rows: list of (label, value, unit_or_format)"""
            r = write_section(ws, r, title, ncols=3)
            for i, (label, value, fmt) in enumerate(rows):
                ws.cell(row=r, column=1, value=f"  {label}")
                cell = ws.cell(row=r, column=2, value=value)
                ws.cell(row=r, column=3, value=fmt)
                if fmt == "$" and isinstance(value, (int, float)):
                    cell.number_format = "$#,##0.00"
                style_row(ws, r, 3, alt=i % 2 == 1)
                r += 1
            return r + 1

        mat_r  = results.get("material", {})
        mach_r = results.get("machine", {})
        bp_r   = results.get("build_prep", {})
        cons_r = results.get("consumables", {})
        lab_r  = results.get("labor", {})
        pp_r   = results.get("post_process", {})
        ext_r  = results.get("metal_am_extensions", {})

        r2 = breakdown_section(ws2, r2, "1. MATERIAL", [
            ("Total Part Material",    round(mat_r.get("total_part_material_kg", 0), 4), "kg"),
            ("Total Support Material", round(mat_r.get("total_support_material_kg", 0), 4), "kg"),
            ("Total Build Material",   round(mat_r.get("total_build_material_kg", 0), 4), "kg"),
            ("Recycled Material",      round(mat_r.get("recycled_material_kg", 0), 4), "kg"),
            ("Material Waste",         round(mat_r.get("material_waste_kg", 0), 4), "kg"),
            ("Net Material Required",  round(mat_r.get("material_required_kg", 0), 4), "kg"),
            ("Material Cost",          round(mat_r.get("cost", 0), 2), "$"),
        ])

        r2 = breakdown_section(ws2, r2, "2. BUILD PREPARATION", [
            ("Total Prep Time",        round(bp_r.get("total_time_hr", 0), 2), "hr"),
            ("Prep Cost",              round(bp_r.get("cost", 0), 2), "$"),
        ])

        r2 = breakdown_section(ws2, r2, "3. MACHINE USAGE", [
            ("Machine Cost/Hour",      round(mach_r.get("machine_cost_per_hour", 0), 2), "$/hr"),
            ("Warmup Time",            round(mach_r.get("total_warmup_hr", 0), 2), "hr"),
            ("Laser Scan Time",        round(mach_r.get("total_scan_hr", 0), 2), "hr"),
            ("Recoating Time",         round(mach_r.get("total_recoating_hr", 0), 2), "hr"),
            ("Total Print Time",       round(mach_r.get("total_print_hr", 0), 2), "hr"),
            ("Cooldown Time",          round(mach_r.get("total_cooldown_hr", 0), 2), "hr"),
            ("Build Exchange Time",    round(mach_r.get("total_build_exchange_hr", 0), 2), "hr"),
            ("Total Machine Time",     round(mach_r.get("total_machine_time_hr", 0), 2), "hr"),
            ("Machine Cost",           round(mach_r.get("cost", 0), 2), "$"),
        ])

        r2 = breakdown_section(ws2, r2, "4. CONSUMABLES", [
            ("Inert Gas Cost",         round(cons_r.get("inert_gas_cost", 0), 2), "$"),
            ("Per-Build Consumables",  round(cons_r.get("per_build_consumables", 0), 2), "$"),
            ("Total Consumables",      round(cons_r.get("cost", 0), 2), "$"),
        ])

        r2 = breakdown_section(ws2, r2, "5. LABOR", [
            ("Labor During Build",     round(lab_r.get("labor_during_build_hr", 0), 2), "hr"),
            ("Build Exchange Labor",   round(lab_r.get("labor_build_exchange_hr", 0), 2), "hr"),
            ("Total Labor",            round(lab_r.get("total_labor_hr", 0), 2), "hr"),
            ("Labor Cost",             round(lab_r.get("cost", 0), 2), "$"),
        ])

        r2 = breakdown_section(ws2, r2, "6. POST-PROCESS — Support Removal", [
            ("Support Removal Time",   round(pp_r.get("support_removal_time_hr", 0), 2), "hr"),
            ("Post-Process Cost",      round(pp_r.get("cost", 0), 2), "$"),
        ])

        r2 = breakdown_section(ws2, r2, "7. METAL AM POST-PROCESSING", [
            ("Heat Treatment",         round(ext_r.get("heat_treatment_cost", 0), 2), "$"),
            ("Part Separation",        round(ext_r.get("part_separation_cost", 0), 2), "$"),
            ("HIP",                    round(ext_r.get("hip_cost", 0), 2), "$"),
            ("Surface Treatment",      round(ext_r.get("surface_treatment_cost", 0), 2), "$"),
            ("NDT / Inspection",       round(ext_r.get("ndt_cost", 0), 2), "$"),
        ])

        ws2.column_dimensions["A"].width = 36
        ws2.column_dimensions["B"].width = 18
        ws2.column_dimensions["C"].width = 10

        # ══════════════════════════════════════════════════════════════════════
        # SHEET 3 — Machine & Process
        # ══════════════════════════════════════════════════════════════════════
        ws3 = wb.create_sheet("Machine & Process")
        ws3["A1"] = "Machine & Process Configuration"
        ws3["A1"].font = _title_font()

        r3 = 3
        r3 = write_section(ws3, r3, "MACHINE SPECIFICATIONS", ncols=2)
        r3 = kv_rows(ws3, r3, [
            ("Machine Name",        inputs.get("machine_name",  "–")),
            ("Manufacturer",        inputs.get("machine_manufacturer", "–")),
            ("Build Plate",         inputs.get("machine_build_plate", "–")),
            ("Build Height",        _f(inputs.get("machine_build_height_mm"), 0, " mm")),
            ("Build Area",          _f(inputs.get("machine_build_area_cm2"), 1, " cm²")),
            ("Machine Purchase Cost", _c(inputs.get("machine_cost_usd", 0))),
            ("Number of Lasers",    str(inputs.get("machine_num_lasers", 1))),
            ("Packing Policy",      inputs.get("machine_packing_policy", "2D")),
            ("Packing Fraction",    _f((inputs.get("machine_packing_fraction") or 0.9) * 100, 0, "%")),
            ("Machine Uptime",      _f((inputs.get("machine_uptime") or 0.8) * 100, 0, "%")),
            ("Powder Recycling",    _f((inputs.get("machine_recycling_fraction") or 0.9) * 100, 0, "%")),
        ])

        r3 = write_section(ws3, r3, "PROCESS PARAMETERS", ncols=2)
        r3 = kv_rows(ws3, r3, [
            ("Build Direction",          (inputs.get("build_direction") or "–").upper()),
            ("Elevation above Plate",    _f(inputs.get("elevation_mm", 0), 0, " mm")),
            ("Material Build Rate",      _f(inputs.get("material_build_rate_cm3_hr"), 1, " cm³/hr")),
            ("Layer Thickness",          _f(inputs.get("layer_thickness_um"), 0, " µm")),
            ("Laser Strategy",           inputs.get("laser_strategy", "single")),
            ("Lasers per Part",          str(inputs.get("lasers_per_part", 1))),
            ("Recoating Efficiency",     _f((inputs.get("recoating_efficiency") or 0.75) * 100, 0, "%")),
            ("Parts per Build Override", str(inputs.get("parts_per_build_override") or "Auto")),
        ])

        r3 = write_section(ws3, r3, "POST-PROCESSING INPUTS", ncols=2)
        r3 = kv_rows(ws3, r3, [
            ("Heat Treatment",           "Enabled" if inputs.get("heat_treatment_enabled") else "Disabled"),
            ("  → Cost per Build",       _c(inputs.get("heat_treatment_cost_per_build", 0))),
            ("Part Separation",          "Enabled" if inputs.get("part_separation_enabled") else "Disabled"),
            ("  → Cost per Part",        _c(inputs.get("part_separation_cost_per_part", 0))),
            ("HIP",                      "Enabled" if inputs.get("hip_enabled") else "Disabled"),
            ("  → Cost per Part",        _c(inputs.get("hip_cost_per_part", 0))),
            ("Surface Treatment",        "Enabled" if inputs.get("surface_treatment_enabled") else "Disabled"),
            ("  → Cost per Part",        _c(inputs.get("surface_treatment_cost_per_part", 0))),
            ("NDT / Inspection",         "Enabled" if inputs.get("ndt_enabled") else "Disabled"),
            ("  → Cost per Part",        _c(inputs.get("ndt_cost_per_part", 0))),
        ])

        ws3.column_dimensions["A"].width = 30
        ws3.column_dimensions["B"].width = 25

        # ══════════════════════════════════════════════════════════════════════
        # SHEET 4 — Material & Part
        # ══════════════════════════════════════════════════════════════════════
        ws4 = wb.create_sheet("Material & Part")
        ws4["A1"] = "Material & Part Specification"
        ws4["A1"].font = _title_font()

        r4 = 3
        r4 = write_section(ws4, r4, "MATERIAL", ncols=2)
        r4 = kv_rows(ws4, r4, [
            ("Name",                inputs.get("material_name", "–")),
            ("Alloy Designation",   inputs.get("material_alloy", "–")),
            ("Category",            inputs.get("material_category", "–")),
            ("Cost per kg",         _c(inputs.get("material_cost_per_kg", 0))),
            ("Density",             _f(inputs.get("material_density_g_cm3"), 2, " g/cm³")),
            ("Layer Thickness",     _f(inputs.get("layer_thickness_um"), 0, " µm")),
            ("Build Rate",          _f(inputs.get("material_build_rate_cm3_hr"), 1, " cm³/hr")),
        ])

        r4 = write_section(ws4, r4, "PART GEOMETRY", ncols=2)
        r4 = kv_rows(ws4, r4, [
            ("Part File",           inputs.get("part_file_name", "–")),
            ("Volume",              _f(inputs.get("part_volume_cm3"), 3, " cm³")),
            ("Height (build dir.)", _f((inputs.get("part_height_cm") or 0) * 10, 2, " mm")),
            ("Projected Area",      _f(inputs.get("part_projected_area_cm2"), 2, " cm²")),
            ("Mass (computed)",     _f(inputs.get("part_mass_kg"), 4, " kg")),
            ("Support Fraction",    _f((inputs.get("support_pct_of_mass") or 0) * 100, 1, "%")),
            ("Elevation above Plate", _f(inputs.get("elevation_mm", 0), 0, " mm")),
        ])

        r4 = write_section(ws4, r4, "PRODUCTION", ncols=2)
        r4 = kv_rows(ws4, r4, [
            ("Production Run",      f"{prod_run:,} parts"),
            ("Parts per Build",     str(results.get("parts_per_build", "–"))),
            ("Number of Builds",    str(results.get("num_builds", "–"))),
            ("Total Machine Time",  _f(mach_r.get("total_machine_time_hr", 0), 1, " hr")),
        ])

        ws4.column_dimensions["A"].width = 28
        ws4.column_dimensions["B"].width = 25

        # ══════════════════════════════════════════════════════════════════════
        # SHEET 5 — Quantity Curve
        # ══════════════════════════════════════════════════════════════════════
        if quantity_curve:
            ws5 = wb.create_sheet("Quantity Curve")
            ws5["A1"] = "Cost vs Quantity Data"
            ws5["A1"].font = _title_font()

            headers = [
                "Qty", "Cost/Part ($)", "Total Cost ($)",
                "Material/Part", "Machine/Part", "Labor/Part",
                "Consumables/Part", "Build Prep/Part", "Post-Process/Part",
                "Parts/Build", "# Builds",
            ]
            r5 = 3
            for c, h in enumerate(headers, 1):
                ws5.cell(row=r5, column=c, value=h)
            style_hdr(ws5, r5, len(headers))

            for i, pt in enumerate(quantity_curve):
                r5 += 1
                vals = [
                    pt.get("quantity"),
                    pt.get("cost_per_part"),
                    pt.get("total_cost"),
                    pt.get("material_cost"),
                    pt.get("machine_cost"),
                    pt.get("labor_cost"),
                    pt.get("consumables_cost"),
                    pt.get("build_prep_cost"),
                    pt.get("post_process_cost"),
                    pt.get("parts_per_build"),
                    pt.get("num_builds"),
                ]
                for c, v in enumerate(vals, 1):
                    cell = ws5.cell(row=r5, column=c, value=round(v, 2) if isinstance(v, float) else v)
                    if 2 <= c <= 9:
                        cell.number_format = "$#,##0.00"
                style_row(ws5, r5, len(headers), alt=i % 2 == 1)

            for c in range(1, len(headers) + 1):
                ws5.column_dimensions[get_column_letter(c)].width = 15
            ws5.column_dimensions["A"].width = 8

        wb.save(output_path)
        return output_path
    except Exception as e:
        raise Exception(f"Excel export failed: {str(e)}")


# ─── PDF ──────────────────────────────────────────────────────────────────────

def export_to_pdf(
    project_name: str,
    inputs: dict,
    results: dict,
    output_path: str,
    quantity_curve: Optional[list] = None,
) -> str:
    """Comprehensive PDF report."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import inch, cm
        from reportlab.platypus import (
            SimpleDocTemplate, Table, TableStyle, Paragraph,
            Spacer, HRFlowable, KeepTogether,
        )
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

        W, H = A4
        margin = 1.8 * cm
        col_w = W - 2 * margin

        doc = SimpleDocTemplate(
            output_path,
            pagesize=A4,
            leftMargin=margin, rightMargin=margin,
            topMargin=margin, bottomMargin=margin,
        )
        styles = getSampleStyleSheet()

        # ── Custom styles ──────────────────────────────────────────────────────
        NAVY  = colors.HexColor("#1B2A4A")
        BLUE  = colors.HexColor("#1E40AF")
        CYAN  = colors.HexColor("#0891B2")
        CYAN_LIGHT = colors.HexColor("#CFFAFE")
        ALT   = colors.HexColor("#EFF6FF")
        GREY  = colors.HexColor("#F8FAFC")
        WHITE = colors.white
        DARK  = colors.HexColor("#374151")
        MUTED = colors.HexColor("#6B7280")

        def _style(name, **kw):
            return ParagraphStyle(name, parent=styles["Normal"], **kw)

        s_title    = _style("Title2",   fontSize=18, textColor=NAVY,  spaceAfter=4,  fontName="Helvetica-Bold")
        s_subtitle = _style("Subtitle", fontSize=10, textColor=MUTED, spaceAfter=16, fontName="Helvetica")
        s_h2       = _style("H2",       fontSize=11, textColor=NAVY,  spaceBefore=12, spaceAfter=4, fontName="Helvetica-Bold")
        s_body     = _style("Body",     fontSize=9,  textColor=DARK,  leading=13)
        s_mono     = _style("Mono",     fontSize=9,  fontName="Courier", textColor=DARK)

        def _tbl_style(header_rows=1, stripe=True, nrows=0):
            ts = TableStyle([
                ('BACKGROUND',   (0, 0), (-1, header_rows - 1), BLUE),
                ('TEXTCOLOR',    (0, 0), (-1, header_rows - 1), WHITE),
                ('FONTNAME',     (0, 0), (-1, header_rows - 1), 'Helvetica-Bold'),
                ('FONTSIZE',     (0, 0), (-1, -1), 8.5),
                ('GRID',         (0, 0), (-1, -1), 0.4, colors.HexColor("#D1D5DB")),
                ('LEFTPADDING',  (0, 0), (-1, -1), 6),
                ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING',   (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING',(0, 0), (-1, -1), 4),
                ('VALIGN',       (0, 0), (-1, -1), 'MIDDLE'),
                ('ALIGN',        (1, 0), (-1, -1), 'RIGHT'),
                ('ALIGN',        (0, 0), (0, -1), 'LEFT'),
            ])
            if stripe and nrows > header_rows:
                for i in range(header_rows, nrows, 2):
                    ts.add('BACKGROUND', (0, i), (-1, i), ALT)
            return ts

        def _section_table(rows, col_widths=None):
            """Build a 2-col (label, value) section table."""
            col_widths = col_widths or [col_w * 0.5, col_w * 0.5]
            data = [[Paragraph(f"<b>{label}</b>", s_body), Paragraph(str(value), s_body)]
                    for label, value in rows]
            n = len(data)
            tbl = Table(data, colWidths=col_widths)
            tbl.setStyle(TableStyle([
                ('FONTSIZE',     (0, 0), (-1, -1), 8.5),
                ('GRID',         (0, 0), (-1, -1), 0.4, colors.HexColor("#D1D5DB")),
                ('LEFTPADDING',  (0, 0), (-1, -1), 6),
                ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING',   (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING',(0, 0), (-1, -1), 3),
                ('VALIGN',       (0, 0), (-1, -1), 'MIDDLE'),
                ('ALIGN',        (1, 0), (-1, -1), 'RIGHT'),
                ('ALIGN',        (0, 0), (0, -1), 'LEFT'),
                *[('BACKGROUND', (0, i), (-1, i), ALT) for i in range(0, n, 2)],
            ]))
            return tbl

        story = []
        total     = results.get("total_cost", 0) or 1
        cpp       = results.get("cost_per_part", 0) or 0
        prod_run  = inputs.get("production_run", 1) or 1
        machine_name  = inputs.get("machine_name",  inputs.get("machine",  "–"))
        material_name = inputs.get("material_name", inputs.get("material", "–"))

        # ── Title ──────────────────────────────────────────────────────────────
        story.append(Paragraph("Metal AM Cost Analysis Report", s_title))
        story.append(Paragraph(
            f"<b>Project:</b> {project_name}  ·  "
            f"<b>Machine:</b> {machine_name}  ·  "
            f"<b>Material:</b> {material_name}  ·  "
            f"Generated {datetime.now().strftime('%B %d, %Y')}",
            s_subtitle
        ))
        story.append(HRFlowable(width="100%", thickness=1.5, color=BLUE, spaceAfter=10))

        # ── Cost Summary ───────────────────────────────────────────────────────
        story.append(Paragraph("Cost Summary", s_h2))
        summary_data = [
            ["Metric", "Value"],
            ["Cost per Part",     _c(cpp)],
            ["Total Run Cost",    _c(total)],
            ["Production Run",    f"{prod_run:,} parts"],
            ["Parts per Build",   str(results.get("parts_per_build", "–"))],
            ["Number of Builds",  str(results.get("num_builds", "–"))],
            ["Total Machine Time", _f(results.get("machine", {}).get("total_machine_time_hr", 0), 1, " hr")],
        ]
        tbl = Table(summary_data, colWidths=[col_w * 0.55, col_w * 0.45])
        tbl.setStyle(_tbl_style(nrows=len(summary_data)))
        story.append(KeepTogether([tbl]))
        story.append(Spacer(1, 10))

        # ── Cost Breakdown ─────────────────────────────────────────────────────
        story.append(Paragraph("Cost Breakdown by Category", s_h2))
        categories = [
            ("Material",               results.get("material",         {}).get("cost", 0)),
            ("Build Preparation",      results.get("build_prep",       {}).get("cost", 0)),
            ("Machine Usage",          results.get("machine",          {}).get("cost", 0)),
            ("Consumables",            results.get("consumables",      {}).get("cost", 0)),
            ("Labor",                  results.get("labor",            {}).get("cost", 0)),
            ("Post-Process (Support)", results.get("post_process",     {}).get("cost", 0)),
            ("Heat Treatment",         results.get("metal_am_extensions", {}).get("heat_treatment_cost", 0)),
            ("Part Separation",        results.get("metal_am_extensions", {}).get("part_separation_cost", 0)),
            ("HIP",                    results.get("metal_am_extensions", {}).get("hip_cost", 0)),
            ("Surface Treatment",      results.get("metal_am_extensions", {}).get("surface_treatment_cost", 0)),
            ("NDT / Inspection",       results.get("metal_am_extensions", {}).get("ndt_cost", 0)),
        ]
        bk_data = [["Category", "Cost ($)", "Cost / Part ($)", "% of Total"]]
        for cat, cost in categories:
            if cost == 0:
                continue
            bk_data.append([cat, _c(cost), _c(cost / prod_run), _pct(cost, total)])
        bk_data.append(["TOTAL", _c(total), _c(cpp), "100%"])

        tbl2 = Table(bk_data, colWidths=[col_w * 0.38, col_w * 0.22, col_w * 0.22, col_w * 0.18])
        style2 = _tbl_style(nrows=len(bk_data))
        # Highlight total row
        last = len(bk_data) - 1
        style2.add('BACKGROUND', (0, last), (-1, last), NAVY)
        style2.add('TEXTCOLOR',  (0, last), (-1, last), WHITE)
        style2.add('FONTNAME',   (0, last), (-1, last), 'Helvetica-Bold')
        tbl2.setStyle(style2)
        story.append(KeepTogether([tbl2]))
        story.append(Spacer(1, 10))

        # ── Detailed Machine Time Breakdown ────────────────────────────────────
        story.append(Paragraph("Machine Time Breakdown", s_h2))
        mach_r = results.get("machine", {})
        time_data = [
            ["Phase", "Time (hr)", "Notes"],
            ["Warmup",          _f(mach_r.get("total_warmup_hr", 0), 2),    f"{results.get('num_builds', 0)} builds × warmup"],
            ["Laser Scan",      _f(mach_r.get("total_scan_hr", 0), 2),      "Deposition time only"],
            ["Recoating",       _f(mach_r.get("total_recoating_hr", 0), 2), "Powder spreading overhead"],
            ["Cooldown",        _f(mach_r.get("total_cooldown_hr", 0), 2),  f"{results.get('num_builds', 0)} builds × cooldown"],
            ["Build Exchange",  _f(mach_r.get("total_build_exchange_hr", 0), 2), "Setup + removal"],
            ["TOTAL",           _f(mach_r.get("total_machine_time_hr", 0), 2), ""],
        ]
        tbl3 = Table(time_data, colWidths=[col_w * 0.3, col_w * 0.22, col_w * 0.48])
        style3 = _tbl_style(nrows=len(time_data))
        last3 = len(time_data) - 1
        style3.add('BACKGROUND', (0, last3), (-1, last3), NAVY)
        style3.add('TEXTCOLOR',  (0, last3), (-1, last3), WHITE)
        style3.add('FONTNAME',   (0, last3), (-1, last3), 'Helvetica-Bold')
        tbl3.setStyle(style3)
        story.append(KeepTogether([tbl3]))
        story.append(Spacer(1, 10))

        # ── Material Detail ────────────────────────────────────────────────────
        story.append(Paragraph("Material Detail", s_h2))
        mat_r = results.get("material", {})
        mat_data = [
            ["Parameter", "Value"],
            ["Total Part Material",    _f(mat_r.get("total_part_material_kg", 0), 3, " kg")],
            ["Total Support Material", _f(mat_r.get("total_support_material_kg", 0), 3, " kg")],
            ["Total Build Material",   _f(mat_r.get("total_build_material_kg", 0), 3, " kg")],
            ["Recycled",               _f(mat_r.get("recycled_material_kg", 0), 3, " kg")],
            ["Waste",                  _f(mat_r.get("material_waste_kg", 0), 3, " kg")],
            ["Net Material Required",  _f(mat_r.get("material_required_kg", 0), 3, " kg")],
            ["Material Cost",          _c(mat_r.get("cost", 0))],
        ]
        tbl4 = Table(mat_data, colWidths=[col_w * 0.55, col_w * 0.45])
        tbl4.setStyle(_tbl_style(nrows=len(mat_data)))
        story.append(KeepTogether([tbl4]))
        story.append(Spacer(1, 10))

        # ── Part & Production ──────────────────────────────────────────────────
        story.append(Paragraph("Part & Production Inputs", s_h2))
        part_rows = [
            ("Part File",              inputs.get("part_file_name", "–")),
            ("Volume",                 _f(inputs.get("part_volume_cm3"), 3, " cm³")),
            ("Height (build dir.)",    _f((inputs.get("part_height_cm") or 0) * 10, 2, " mm")),
            ("Projected Area",         _f(inputs.get("part_projected_area_cm2"), 2, " cm²")),
            ("Mass",                   _f(inputs.get("part_mass_kg"), 4, " kg")),
            ("Support Fraction",       _f((inputs.get("support_pct_of_mass") or 0) * 100, 1, "%")),
            ("Build Direction",        (inputs.get("build_direction") or "–").upper()),
            ("Elevation above Plate",  _f(inputs.get("elevation_mm", 0), 0, " mm")),
            ("Production Run",         f"{prod_run:,} parts"),
        ]
        story.append(KeepTogether([_section_table(part_rows)]))
        story.append(Spacer(1, 10))

        # ── Machine & Process ──────────────────────────────────────────────────
        story.append(Paragraph("Machine & Process Configuration", s_h2))
        machine_rows = [
            ("Machine Name",           inputs.get("machine_name", "–")),
            ("Manufacturer",           inputs.get("machine_manufacturer", "–")),
            ("Build Plate",            inputs.get("machine_build_plate", "–")),
            ("Build Height",           _f(inputs.get("machine_build_height_mm"), 0, " mm")),
            ("Build Area",             _f(inputs.get("machine_build_area_cm2"), 1, " cm²")),
            ("Machine Cost",           _c(inputs.get("machine_cost_usd", 0))),
            ("Number of Lasers",       str(inputs.get("machine_num_lasers", 1))),
            ("Laser Strategy",         inputs.get("laser_strategy", "single")),
            ("Recoating Efficiency",   _f((inputs.get("recoating_efficiency") or 0.75) * 100, 0, "%")),
            ("Material Build Rate",    _f(inputs.get("material_build_rate_cm3_hr"), 1, " cm³/hr")),
            ("Layer Thickness",        _f(inputs.get("layer_thickness_um"), 0, " µm")),
            ("Packing Policy",         inputs.get("machine_packing_policy", "2D")),
            ("Packing Fraction",       _f((inputs.get("machine_packing_fraction") or 0.9) * 100, 0, "%")),
        ]
        story.append(KeepTogether([_section_table(machine_rows)]))
        story.append(Spacer(1, 10))

        # ── Material Specification ─────────────────────────────────────────────
        story.append(Paragraph("Material Specification", s_h2))
        mat_spec_rows = [
            ("Name",                   inputs.get("material_name", "–")),
            ("Alloy Designation",      inputs.get("material_alloy", "–")),
            ("Category",               inputs.get("material_category", "–")),
            ("Cost per kg",            _c(inputs.get("material_cost_per_kg", 0))),
            ("Density",                _f(inputs.get("material_density_g_cm3"), 2, " g/cm³")),
        ]
        story.append(KeepTogether([_section_table(mat_spec_rows)]))
        story.append(Spacer(1, 10))

        # ── Quantity Curve (selected points) ───────────────────────────────────
        if quantity_curve:
            story.append(Paragraph("Cost vs Quantity (selected data points)", s_h2))
            # Pick ~15 evenly spaced points
            step = max(1, len(quantity_curve) // 15)
            pts = quantity_curve[::step]
            if quantity_curve[-1] not in pts:
                pts.append(quantity_curve[-1])
            qc_data = [["Qty", "Cost/Part", "Total Cost", "Parts/Build", "# Builds"]]
            for pt in pts:
                qc_data.append([
                    str(pt.get("quantity", "")),
                    _c(pt.get("cost_per_part", 0)),
                    _c(pt.get("total_cost", 0)),
                    str(pt.get("parts_per_build", "")),
                    str(pt.get("num_builds", "")),
                ])
            tblq = Table(qc_data, colWidths=[col_w * 0.12, col_w * 0.22, col_w * 0.24, col_w * 0.22, col_w * 0.20])
            tblq.setStyle(_tbl_style(nrows=len(qc_data)))
            story.append(KeepTogether([tblq]))

        doc.build(story)
        return output_path
    except Exception as e:
        raise Exception(f"PDF export failed: {str(e)}")
