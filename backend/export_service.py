import io
import os
from datetime import datetime
from typing import Optional


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _c(v) -> str:
    try:
        return f"${float(v):,.2f}"
    except (TypeError, ValueError):
        return "–"


def _pct(v, total) -> str:
    try:
        if total and float(total) > 0:
            return f"{float(v) / float(total) * 100:.1f}%"
        return "0%"
    except (TypeError, ValueError):
        return "–"


def _f(v, decimals=2, suffix="") -> str:
    try:
        return f"{round(float(v), decimals):,}{suffix}"
    except (TypeError, ValueError):
        return str(v) if v is not None else "–"


def _pct_float(v, total) -> float:
    try:
        if total and float(total) > 0:
            return round(float(v) / float(total) * 100, 1)
        return 0.0
    except (TypeError, ValueError):
        return 0.0


# ─── Chart helpers (matplotlib → PNG bytes) ───────────────────────────────────

def _make_bar_chart(labels, values, title="", colors=None, figsize=(7, 3.5)):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.ticker as mticker

    fig, ax = plt.subplots(figsize=figsize)
    fig.patch.set_facecolor("#0f1623")
    ax.set_facecolor("#0f1623")

    default_colors = [
        "#3b82f6", "#06b6d4", "#8b5cf6", "#f59e0b",
        "#10b981", "#ef4444", "#f97316", "#a78bfa", "#34d399", "#fb923c", "#e879f9"
    ]
    bar_colors = colors or default_colors[:len(labels)]

    bars = ax.bar(labels, values, color=bar_colors, width=0.6, zorder=3)
    ax.set_title(title, color="white", fontsize=11, pad=10, fontweight="bold")
    ax.tick_params(colors="white", labelsize=8)
    ax.xaxis.set_tick_params(rotation=30)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"${x:,.0f}"))
    for spine in ax.spines.values():
        spine.set_edgecolor("#1e2a45")
    ax.yaxis.set_tick_params(colors="#94a3b8")
    ax.xaxis.set_tick_params(colors="#94a3b8")
    ax.grid(axis="y", color="#1e2a45", linestyle="--", linewidth=0.7, zorder=0)
    ax.set_xlabel("")

    for bar, val in zip(bars, values):
        if val > 0:
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height() * 1.02,
                f"${val:,.0f}",
                ha="center", va="bottom", color="white", fontsize=7, fontweight="bold"
            )

    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, facecolor=fig.get_facecolor())
    plt.close(fig)
    buf.seek(0)
    return buf.read()


def _make_pie_chart(labels, values, title="", figsize=(5, 3.8)):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    colors = [
        "#3b82f6", "#06b6d4", "#8b5cf6", "#f59e0b",
        "#10b981", "#ef4444", "#f97316", "#a78bfa", "#34d399", "#fb923c"
    ]
    filtered = [(l, v, c) for l, v, c in zip(labels, values, colors[:len(labels)]) if v > 0]
    if not filtered:
        return None
    fl, fv, fc = zip(*filtered)

    fig, ax = plt.subplots(figsize=figsize)
    fig.patch.set_facecolor("#0f1623")
    ax.set_facecolor("#0f1623")

    wedges, texts, autotexts = ax.pie(
        fv, labels=None, colors=fc, autopct="%1.1f%%",
        startangle=140, pctdistance=0.78,
        wedgeprops={"linewidth": 0.5, "edgecolor": "#0f1623"}
    )
    for at in autotexts:
        at.set_color("white")
        at.set_fontsize(7)

    ax.legend(
        wedges, [f"{l}" for l in fl],
        loc="center left", bbox_to_anchor=(1, 0.5),
        fontsize=8, frameon=False, labelcolor="white"
    )
    ax.set_title(title, color="white", fontsize=11, pad=8, fontweight="bold")

    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, facecolor=fig.get_facecolor(), bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf.read()


def _make_line_chart(quantity_curve, current_qty=None, figsize=(9, 3.8)):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.ticker as mticker

    if not quantity_curve:
        return None

    qs  = [pt["quantity"]     for pt in quantity_curve]
    cpp = [pt["cost_per_part"] for pt in quantity_curve]
    mat = [pt.get("material_cost", 0) for pt in quantity_curve]
    mac = [pt.get("machine_cost",  0) for pt in quantity_curve]

    fig, ax = plt.subplots(figsize=figsize)
    fig.patch.set_facecolor("#0f1623")
    ax.set_facecolor("#0f1623")

    ax.plot(qs, cpp, color="#3b82f6", linewidth=2,   label="Total $/part")
    ax.plot(qs, mat, color="#06b6d4", linewidth=1.4, label="Material $/part", linestyle="--")
    ax.plot(qs, mac, color="#8b5cf6", linewidth=1.4, label="Machine $/part",  linestyle="--")

    if current_qty:
        ax.axvline(current_qty, color="#f59e0b", linestyle=":", linewidth=1.2, label=f"Current qty ({current_qty:,})")

    ax.set_title("Cost per Part vs Production Quantity", color="white", fontsize=11, pad=10, fontweight="bold")
    ax.tick_params(colors="#94a3b8", labelsize=8)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"${x:,.0f}"))
    ax.xaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"{int(x):,}"))
    for spine in ax.spines.values():
        spine.set_edgecolor("#1e2a45")
    ax.grid(color="#1e2a45", linestyle="--", linewidth=0.6)
    ax.legend(fontsize=8, frameon=False, labelcolor="white")

    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, facecolor=fig.get_facecolor())
    plt.close(fig)
    buf.seek(0)
    return buf.read()


# ─── Excel ────────────────────────────────────────────────────────────────────

def export_to_excel(
    project_name: str,
    inputs: dict,
    results: dict,
    output_path: str,
    quantity_curve: Optional[list] = None,
) -> str:
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, GradientFill
        from openpyxl.utils import get_column_letter
        from openpyxl.drawing.image import Image as XLImage
        from openpyxl.chart import BarChart, PieChart, LineChart, Reference
        from openpyxl.chart.series import DataPoint

        wb = Workbook()

        # ── Palette ────────────────────────────────────────────────────────────
        NAVY        = "1B2A4A"
        BLUE        = "1E3A8A"
        BLUE_MID    = "2563EB"
        CYAN        = "0891B2"
        CYAN_LIGHT  = "E0F7FA"
        WHITE       = "FFFFFF"
        GREY_LIGHT  = "F8FAFC"
        ALT         = "EFF6FF"
        DARK_ROW    = "1E2A45"
        GOLD        = "F59E0B"

        def _font(bold=False, color=None, size=10, italic=False):
            return Font(name="Calibri", bold=bold, color=color or "374151", size=size, italic=italic)

        _side = Side(style="thin", color="CBD5E1")
        _border = Border(left=_side, right=_side, top=_side, bottom=_side)
        _thick_bottom = Border(left=_side, right=_side, top=_side, bottom=Side(style="medium", color=BLUE_MID))
        _center = Alignment(horizontal="center", vertical="center", wrap_text=True)
        _right  = Alignment(horizontal="right",  vertical="center")
        _left   = Alignment(horizontal="left",   vertical="center", indent=1)

        def fill(color): return PatternFill("solid", fgColor=color)

        def hdr_cell(ws, row, col, text, bg=BLUE, fg=WHITE, sz=10, bold=True, align=_center):
            c = ws.cell(row=row, column=col, value=text)
            c.font  = Font(name="Calibri", bold=bold, color=fg, size=sz)
            c.fill  = fill(bg)
            c.border = _border
            c.alignment = align
            return c

        def val_cell(ws, row, col, value, bold=False, color="374151", align=None, fmt=None, bg=None):
            c = ws.cell(row=row, column=col, value=value)
            c.font   = _font(bold=bold, color=color)
            c.border = _border
            c.alignment = align or (_right if isinstance(value, (int, float)) else _left)
            if fmt: c.number_format = fmt
            if bg:  c.fill = fill(bg)
            return c

        def section_header(ws, row, text, ncols, bg=CYAN, fg=WHITE):
            ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=ncols)
            c = ws.cell(row=row, column=1, value=f"  {text}")
            c.font      = Font(name="Calibri", bold=True, color=fg, size=10)
            c.fill      = fill(bg)
            c.border    = _border
            c.alignment = _left
            for col in range(2, ncols + 1):
                ws.cell(row=row, column=col).fill   = fill(bg)
                ws.cell(row=row, column=col).border = _border
            return row + 1

        def kv_block(ws, start_row, pairs, ncols=2, alt=True):
            r = start_row
            for i, (label, value) in enumerate(pairs):
                bg = ALT if (alt and i % 2 == 0) else GREY_LIGHT
                val_cell(ws, r, 1, label, bg=bg, align=_left)
                val_cell(ws, r, 2, value, bg=bg)
                r += 1
            return r + 1

        total    = results.get("total_cost", 0) or 1
        cpp      = results.get("cost_per_part", 0) or 0
        prod_run = inputs.get("production_run", 1) or 1

        cat_data = [
            ("Material",                results.get("material",         {}).get("cost", 0)),
            ("Build Preparation",       results.get("build_prep",       {}).get("cost", 0)),
            ("Machine Usage",           results.get("machine",          {}).get("cost", 0)),
            ("Consumables",             results.get("consumables",      {}).get("cost", 0)),
            ("Labor",                   results.get("labor",            {}).get("cost", 0)),
            ("Post-Process",            results.get("post_process",     {}).get("cost", 0)),
            ("Heat Treatment",          results.get("metal_am_extensions", {}).get("heat_treatment_cost", 0)),
            ("Part Separation",         results.get("metal_am_extensions", {}).get("part_separation_cost", 0)),
            ("HIP",                     results.get("metal_am_extensions", {}).get("hip_cost", 0)),
            ("Surface Treatment",       results.get("metal_am_extensions", {}).get("surface_treatment_cost", 0)),
            ("NDT / Inspection",        results.get("metal_am_extensions", {}).get("ndt_cost", 0)),
        ]
        active_cats = [(n, v) for n, v in cat_data if v and v > 0]

        machine_name  = inputs.get("machine_name",  inputs.get("machine",  "–"))
        material_name = inputs.get("material_name", inputs.get("material", "–"))

        # ══════════════════════════════════════════════════════════════════════
        # SHEET 1 — Summary Dashboard
        # ══════════════════════════════════════════════════════════════════════
        ws1 = wb.active
        ws1.title = "Summary"
        ws1.sheet_view.showGridLines = False
        ws1.column_dimensions["A"].width = 26
        ws1.column_dimensions["B"].width = 20
        ws1.column_dimensions["C"].width = 20
        ws1.column_dimensions["D"].width = 16
        ws1.column_dimensions["E"].width = 2   # spacer
        ws1.column_dimensions["F"].width = 28
        ws1.column_dimensions["G"].width = 20

        # Title banner (A1:D2)
        ws1.merge_cells("A1:D2")
        banner = ws1["A1"]
        banner.value    = "Metal AM Cost Analysis Report"
        banner.font     = Font(name="Calibri", bold=True, color=WHITE, size=18)
        banner.fill     = fill(NAVY)
        banner.alignment = Alignment(horizontal="left", vertical="center", indent=2)
        ws1.row_dimensions[1].height = 22
        ws1.row_dimensions[2].height = 22
        for col in range(2, 5):
            ws1.cell(row=1, column=col).fill = fill(NAVY)
            ws1.cell(row=2, column=col).fill = fill(NAVY)

        # Sub-info row
        ws1.merge_cells("A3:D3")
        sub = ws1["A3"]
        sub.value     = f"Project: {project_name}  ·  Machine: {machine_name}  ·  Material: {material_name}  ·  {datetime.now().strftime('%B %d, %Y')}"
        sub.font      = Font(name="Calibri", color="B0C4D8", size=9, italic=True)
        sub.fill      = fill(BLUE)
        sub.alignment = Alignment(horizontal="left", vertical="center", indent=2)
        ws1.row_dimensions[3].height = 16
        for col in range(2, 5):
            ws1.cell(row=3, column=col).fill = fill(BLUE)

        # ── KPI Cards (row 5–8, cols A-D) ────────────────────────────────────
        kpis = [
            ("Cost per Part",  _c(cpp),           BLUE_MID),
            ("Total Run Cost", _c(total),          NAVY),
            ("Parts per Build", str(results.get("parts_per_build", "–")), "0F5132"),
            ("# of Builds",    str(results.get("num_builds", "–")),       "6B21A8"),
        ]
        ws1.row_dimensions[5].height = 8   # spacer
        for i, (label, value, bg) in enumerate(kpis, 1):
            c_label = ws1.cell(row=6, column=i, value=label)
            c_label.font      = Font(name="Calibri", bold=True, color=WHITE, size=9)
            c_label.fill      = fill(bg)
            c_label.alignment = Alignment(horizontal="center", vertical="center")
            c_label.border    = _border

            c_val = ws1.cell(row=7, column=i, value=value)
            c_val.font      = Font(name="Calibri", bold=True, color=WHITE, size=14)
            c_val.fill      = fill(bg)
            c_val.alignment = Alignment(horizontal="center", vertical="center")
            c_val.border    = _border

            ws1.row_dimensions[6].height = 16
            ws1.row_dimensions[7].height = 28

        # ── Cost Breakdown table (row 10+) ─────────────────────────────────
        r = 10
        r = section_header(ws1, r, "COST BY CATEGORY", 4, bg=NAVY)
        for col, h in enumerate(["Category", "Total Cost", "Cost / Part", "% of Total"], 1):
            hdr_cell(ws1, r, col, h, bg=BLUE_MID, sz=9)
        r += 1

        for i, (cat, cost) in enumerate(active_cats):
            bg = ALT if i % 2 == 0 else GREY_LIGHT
            val_cell(ws1, r, 1, cat,   bg=bg, align=_left)
            val_cell(ws1, r, 2, round(cost, 2), bg=bg, fmt="$#,##0.00")
            val_cell(ws1, r, 3, round(cost / prod_run, 4), bg=bg, fmt="$#,##0.00")
            val_cell(ws1, r, 4, _pct_float(cost, total) / 100, bg=bg, fmt="0.0%")
            r += 1

        # Total row
        for col, (v, fmt) in enumerate([
            ("TOTAL", None), (round(total, 2), "$#,##0.00"),
            (round(cpp, 2), "$#,##0.00"), (1.0, "0%")
        ], 1):
            c = ws1.cell(row=r, column=col, value=v)
            c.font      = Font(name="Calibri", bold=True, color=WHITE, size=10)
            c.fill      = fill(NAVY)
            c.border    = _border
            c.alignment = _right if col > 1 else _left
            if fmt: c.number_format = fmt
        r += 2

        # ── Part & Machine summary (right column F-G) ─────────────────────
        rr = 6
        rr = section_header(ws1, rr, "PART & PRODUCTION", 2, bg=NAVY)
        ws1.cell(row=rr - 1, column=6).fill = fill(NAVY)
        ws1.cell(row=rr - 1, column=7).fill = fill(NAVY)
        # re-do header in F:G columns
        for col in range(6, 8):
            ws1.cell(row=rr - 1, column=col).fill   = fill(NAVY)
            ws1.cell(row=rr - 1, column=col).border = _border

        def kv_right(ws, row, label, value, i):
            bg = ALT if i % 2 == 0 else GREY_LIGHT
            c1 = ws.cell(row=row, column=6, value=label)
            c2 = ws.cell(row=row, column=7, value=value)
            for c in (c1, c2):
                c.fill   = fill(bg)
                c.border = _border
                c.font   = _font(color="374151", size=9)
            c1.alignment = _left
            c2.alignment = _right

        part_kv = [
            ("Machine",       machine_name),
            ("Material",      material_name),
            ("Production Run", f"{prod_run:,} parts"),
            ("Part Volume",   _f(inputs.get("part_volume_cm3"), 2, " cm³")),
            ("Part Height",   _f((inputs.get("part_height_cm") or 0) * 10, 1, " mm")),
            ("Part Mass",     _f(inputs.get("part_mass_kg"), 3, " kg")),
            ("Support Frac.", _f((inputs.get("support_pct_of_mass") or 0) * 100, 1, "%")),
            ("Build Rate",    _f(inputs.get("material_build_rate_cm3_hr"), 1, " cm³/hr")),
            ("Layer Thickness", _f(inputs.get("layer_thickness_um"), 0, " µm")),
        ]
        rr_start = 7
        for i, (lbl, val) in enumerate(part_kv):
            kv_right(ws1, rr_start + i, lbl, val, i)

        # ══════════════════════════════════════════════════════════════════════
        # SHEET 2 — Charts
        # ══════════════════════════════════════════════════════════════════════
        ws_charts = wb.create_sheet("Charts")
        ws_charts.sheet_view.showGridLines = False
        ws_charts.column_dimensions["A"].width = 2

        # Banner
        ws_charts.merge_cells("B1:N2")
        bc = ws_charts["B1"]
        bc.value     = "Visual Analysis"
        bc.font      = Font(name="Calibri", bold=True, color=WHITE, size=16)
        bc.fill      = fill(NAVY)
        bc.alignment = Alignment(horizontal="left", vertical="center", indent=2)
        ws_charts.row_dimensions[1].height = 20
        ws_charts.row_dimensions[2].height = 20
        for col in range(3, 15):
            ws_charts.cell(row=1, column=col).fill = fill(NAVY)
            ws_charts.cell(row=2, column=col).fill = fill(NAVY)

        # Embed matplotlib bar chart
        if active_cats:
            bar_png = _make_bar_chart(
                [n for n, _ in active_cats],
                [v for _, v in active_cats],
                title="Total Cost by Category ($)",
                figsize=(8, 3.8)
            )
            bar_img = XLImage(io.BytesIO(bar_png))
            bar_img.width, bar_img.height = 560, 266
            ws_charts.add_image(bar_img, "B4")

            pie_png = _make_pie_chart(
                [n for n, _ in active_cats],
                [v for _, v in active_cats],
                title="Cost Distribution",
                figsize=(6, 3.8)
            )
            if pie_png:
                pie_img = XLImage(io.BytesIO(pie_png))
                pie_img.width, pie_img.height = 450, 284
                ws_charts.add_image(pie_img, "B24")

        # Quantity curve chart
        if quantity_curve:
            qc_png = _make_line_chart(
                quantity_curve,
                current_qty=prod_run,
                figsize=(10, 3.8)
            )
            if qc_png:
                qc_img = XLImage(io.BytesIO(qc_png))
                qc_img.width, qc_img.height = 660, 252
                ws_charts.add_image(qc_img, "B44")

        # ══════════════════════════════════════════════════════════════════════
        # SHEET 3 — Detailed Cost Breakdown
        # ══════════════════════════════════════════════════════════════════════
        ws3 = wb.create_sheet("Cost Breakdown")
        ws3.sheet_view.showGridLines = False
        ws3.column_dimensions["A"].width = 34
        ws3.column_dimensions["B"].width = 16
        ws3.column_dimensions["C"].width = 10

        ws3.merge_cells("A1:C1")
        t = ws3["A1"]
        t.value, t.font, t.fill, t.alignment = (
            "Detailed Cost Breakdown",
            Font(name="Calibri", bold=True, color=WHITE, size=14),
            fill(NAVY),
            Alignment(horizontal="left", vertical="center", indent=2),
        )
        ws3.row_dimensions[1].height = 28
        for col in range(2, 4): ws3.cell(row=1, column=col).fill = fill(NAVY)
        ws3["A2"].value = project_name
        ws3["A2"].font  = Font(name="Calibri", color="6B7280", size=9, italic=True)
        ws3.row_dimensions[2].height = 14

        r3 = 4

        def bd_section(ws, r, title, rows):
            r = section_header(ws, r, title, 3, bg=BLUE_MID)
            for col, h in enumerate(["Line Item", "Value", "Unit"], 1):
                hdr_cell(ws, r, col, h, bg=CYAN, sz=9)
            r += 1
            for i, (label, value, unit) in enumerate(rows):
                bg = ALT if i % 2 == 0 else GREY_LIGHT
                val_cell(ws, r, 1, f"  {label}", bg=bg, align=_left)
                c = val_cell(ws, r, 2, value, bg=bg)
                if unit == "$" and isinstance(value, (int, float)):
                    c.number_format = "$#,##0.00"
                val_cell(ws, r, 3, unit if unit != "$" else "", bg=bg, align=_center)
                r += 1
            return r + 1

        mat_r  = results.get("material", {})
        mach_r = results.get("machine", {})
        bp_r   = results.get("build_prep", {})
        cons_r = results.get("consumables", {})
        lab_r  = results.get("labor", {})
        pp_r   = results.get("post_process", {})
        ext_r  = results.get("metal_am_extensions", {})

        r3 = bd_section(ws3, r3, "1.  MATERIAL", [
            ("Total Part Material",    round(mat_r.get("total_part_material_kg", 0), 4), "kg"),
            ("Total Support Material", round(mat_r.get("total_support_material_kg", 0), 4), "kg"),
            ("Total Build Material",   round(mat_r.get("total_build_material_kg", 0), 4), "kg"),
            ("Recycled Material",      round(mat_r.get("recycled_material_kg", 0), 4), "kg"),
            ("Material Waste",         round(mat_r.get("material_waste_kg", 0), 4), "kg"),
            ("Net Material Required",  round(mat_r.get("material_required_kg", 0), 4), "kg"),
            ("Material Cost",          round(mat_r.get("cost", 0), 2), "$"),
        ])
        r3 = bd_section(ws3, r3, "2.  BUILD PREPARATION", [
            ("Total Prep Time",  round(bp_r.get("total_time_hr", 0), 2), "hr"),
            ("Prep Cost",        round(bp_r.get("cost", 0), 2), "$"),
        ])
        r3 = bd_section(ws3, r3, "3.  MACHINE USAGE", [
            ("Machine Cost/Hour",   round(mach_r.get("machine_cost_per_hour", 0), 2), "$/hr"),
            ("Warmup Time",         round(mach_r.get("total_warmup_hr", 0), 2), "hr"),
            ("Laser Scan Time",     round(mach_r.get("total_scan_hr", 0), 2), "hr"),
            ("Recoating Time",      round(mach_r.get("total_recoating_hr", 0), 2), "hr"),
            ("Total Print Time",    round(mach_r.get("total_print_hr", 0), 2), "hr"),
            ("Cooldown Time",       round(mach_r.get("total_cooldown_hr", 0), 2), "hr"),
            ("Build Exchange Time", round(mach_r.get("total_build_exchange_hr", 0), 2), "hr"),
            ("Total Machine Time",  round(mach_r.get("total_machine_time_hr", 0), 2), "hr"),
            ("Machine Cost",        round(mach_r.get("cost", 0), 2), "$"),
        ])
        r3 = bd_section(ws3, r3, "4.  CONSUMABLES", [
            ("Inert Gas Cost",        round(cons_r.get("inert_gas_cost", 0), 2), "$"),
            ("Per-Build Consumables", round(cons_r.get("per_build_consumables", 0), 2), "$"),
            ("Total Consumables",     round(cons_r.get("cost", 0), 2), "$"),
        ])
        r3 = bd_section(ws3, r3, "5.  LABOR", [
            ("Labor During Build",   round(lab_r.get("labor_during_build_hr", 0), 2), "hr"),
            ("Build Exchange Labor", round(lab_r.get("labor_build_exchange_hr", 0), 2), "hr"),
            ("Total Labor",          round(lab_r.get("total_labor_hr", 0), 2), "hr"),
            ("Labor Cost",           round(lab_r.get("cost", 0), 2), "$"),
        ])
        r3 = bd_section(ws3, r3, "6.  POST-PROCESS — Support Removal", [
            ("Support Removal Time", round(pp_r.get("support_removal_time_hr", 0), 2), "hr"),
            ("Post-Process Cost",    round(pp_r.get("cost", 0), 2), "$"),
        ])
        r3 = bd_section(ws3, r3, "7.  METAL AM POST-PROCESSING", [
            ("Heat Treatment",    round(ext_r.get("heat_treatment_cost", 0), 2), "$"),
            ("Part Separation",   round(ext_r.get("part_separation_cost", 0), 2), "$"),
            ("HIP",               round(ext_r.get("hip_cost", 0), 2), "$"),
            ("Surface Treatment", round(ext_r.get("surface_treatment_cost", 0), 2), "$"),
            ("NDT / Inspection",  round(ext_r.get("ndt_cost", 0), 2), "$"),
        ])

        # ══════════════════════════════════════════════════════════════════════
        # SHEET 4 — Machine & Process
        # ══════════════════════════════════════════════════════════════════════
        ws4 = wb.create_sheet("Machine & Process")
        ws4.sheet_view.showGridLines = False
        ws4.column_dimensions["A"].width = 30
        ws4.column_dimensions["B"].width = 26

        ws4.merge_cells("A1:B1")
        h4 = ws4["A1"]
        h4.value, h4.font, h4.fill, h4.alignment = (
            "Machine & Process Configuration",
            Font(name="Calibri", bold=True, color=WHITE, size=14),
            fill(NAVY), Alignment(horizontal="left", vertical="center", indent=2),
        )
        ws4.row_dimensions[1].height = 28
        ws4["B1"].fill = fill(NAVY)

        r4 = 3
        r4 = section_header(ws4, r4, "MACHINE SPECIFICATIONS", 2, bg=BLUE_MID)
        r4 = kv_block(ws4, r4, [
            ("Machine Name",        inputs.get("machine_name", "–")),
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
        r4 = section_header(ws4, r4, "PROCESS PARAMETERS", 2, bg=BLUE_MID)
        r4 = kv_block(ws4, r4, [
            ("Build Direction",         (inputs.get("build_direction") or "–").upper()),
            ("Elevation above Plate",   _f(inputs.get("elevation_mm", 0), 0, " mm")),
            ("Material Build Rate",     _f(inputs.get("material_build_rate_cm3_hr"), 1, " cm³/hr")),
            ("Layer Thickness",         _f(inputs.get("layer_thickness_um"), 0, " µm")),
            ("Laser Strategy",          inputs.get("laser_strategy", "single")),
            ("Lasers per Part",         str(inputs.get("lasers_per_part", 1))),
            ("Recoating Efficiency",    _f((inputs.get("recoating_efficiency") or 0.75) * 100, 0, "%")),
            ("Parts per Build Override", str(inputs.get("parts_per_build_override") or "Auto")),
        ])
        r4 = section_header(ws4, r4, "POST-PROCESSING INPUTS", 2, bg=BLUE_MID)
        r4 = kv_block(ws4, r4, [
            ("Heat Treatment",       "Enabled" if inputs.get("heat_treatment_enabled") else "Disabled"),
            ("  → Cost per Build",   _c(inputs.get("heat_treatment_cost_per_build", 0))),
            ("Part Separation",      "Enabled" if inputs.get("part_separation_enabled") else "Disabled"),
            ("  → Cost per Part",    _c(inputs.get("part_separation_cost_per_part", 0))),
            ("HIP",                  "Enabled" if inputs.get("hip_enabled") else "Disabled"),
            ("  → Cost per Part",    _c(inputs.get("hip_cost_per_part", 0))),
            ("Surface Treatment",    "Enabled" if inputs.get("surface_treatment_enabled") else "Disabled"),
            ("  → Cost per Part",    _c(inputs.get("surface_treatment_cost_per_part", 0))),
            ("NDT / Inspection",     "Enabled" if inputs.get("ndt_enabled") else "Disabled"),
            ("  → Cost per Part",    _c(inputs.get("ndt_cost_per_part", 0))),
        ])

        # ══════════════════════════════════════════════════════════════════════
        # SHEET 5 — Material & Part
        # ══════════════════════════════════════════════════════════════════════
        ws5 = wb.create_sheet("Material & Part")
        ws5.sheet_view.showGridLines = False
        ws5.column_dimensions["A"].width = 28
        ws5.column_dimensions["B"].width = 26

        ws5.merge_cells("A1:B1")
        h5 = ws5["A1"]
        h5.value, h5.font, h5.fill, h5.alignment = (
            "Material & Part Specification",
            Font(name="Calibri", bold=True, color=WHITE, size=14),
            fill(NAVY), Alignment(horizontal="left", vertical="center", indent=2),
        )
        ws5.row_dimensions[1].height = 28
        ws5["B1"].fill = fill(NAVY)

        r5 = 3
        r5 = section_header(ws5, r5, "MATERIAL", 2, bg=BLUE_MID)
        r5 = kv_block(ws5, r5, [
            ("Name",             inputs.get("material_name", "–")),
            ("Alloy Designation", inputs.get("material_alloy", "–")),
            ("Category",         inputs.get("material_category", "–")),
            ("Cost per kg",      _c(inputs.get("material_cost_per_kg", 0))),
            ("Density",          _f(inputs.get("material_density_g_cm3"), 2, " g/cm³")),
            ("Layer Thickness",  _f(inputs.get("layer_thickness_um"), 0, " µm")),
            ("Build Rate",       _f(inputs.get("material_build_rate_cm3_hr"), 1, " cm³/hr")),
        ])
        r5 = section_header(ws5, r5, "PART GEOMETRY", 2, bg=BLUE_MID)
        r5 = kv_block(ws5, r5, [
            ("Part File",          inputs.get("part_file_name", "–")),
            ("Volume",             _f(inputs.get("part_volume_cm3"), 3, " cm³")),
            ("Height (build dir.)", _f((inputs.get("part_height_cm") or 0) * 10, 2, " mm")),
            ("Projected Area",     _f(inputs.get("part_projected_area_cm2"), 2, " cm²")),
            ("Mass (computed)",    _f(inputs.get("part_mass_kg"), 4, " kg")),
            ("Support Fraction",   _f((inputs.get("support_pct_of_mass") or 0) * 100, 1, "%")),
            ("Elevation above Plate", _f(inputs.get("elevation_mm", 0), 0, " mm")),
        ])
        r5 = section_header(ws5, r5, "PRODUCTION", 2, bg=BLUE_MID)
        r5 = kv_block(ws5, r5, [
            ("Production Run",    f"{prod_run:,} parts"),
            ("Parts per Build",   str(results.get("parts_per_build", "–"))),
            ("Number of Builds",  str(results.get("num_builds", "–"))),
            ("Total Machine Time", _f(mach_r.get("total_machine_time_hr", 0), 1, " hr")),
        ])

        # ══════════════════════════════════════════════════════════════════════
        # SHEET 6 — Quantity Curve
        # ══════════════════════════════════════════════════════════════════════
        if quantity_curve:
            ws6 = wb.create_sheet("Quantity Curve")
            ws6.sheet_view.showGridLines = False
            for col_letter, w in zip("ABCDEFGHIJK", [8,14,16,14,14,14,14,14,14,10,8]):
                ws6.column_dimensions[col_letter].width = w

            ws6.merge_cells("A1:K1")
            h6 = ws6["A1"]
            h6.value, h6.font, h6.fill, h6.alignment = (
                "Cost vs Quantity Data",
                Font(name="Calibri", bold=True, color=WHITE, size=14),
                fill(NAVY), Alignment(horizontal="left", vertical="center", indent=2),
            )
            ws6.row_dimensions[1].height = 28
            for col in range(2, 12): ws6.cell(row=1, column=col).fill = fill(NAVY)

            headers = [
                "Qty", "Cost/Part ($)", "Total Cost ($)", "Material/Part",
                "Machine/Part", "Labor/Part", "Consumables/Part",
                "Build Prep/Part", "Post-Process/Part", "Parts/Build", "# Builds",
            ]
            r6 = 3
            for c, h in enumerate(headers, 1):
                hdr_cell(ws6, r6, c, h, bg=BLUE_MID, sz=9)

            for i, pt in enumerate(quantity_curve):
                r6 += 1
                vals = [
                    pt.get("quantity"), pt.get("cost_per_part"), pt.get("total_cost"),
                    pt.get("material_cost"), pt.get("machine_cost"), pt.get("labor_cost"),
                    pt.get("consumables_cost"), pt.get("build_prep_cost"),
                    pt.get("post_process_cost"), pt.get("parts_per_build"), pt.get("num_builds"),
                ]
                bg = ALT if i % 2 == 0 else GREY_LIGHT
                for c, v in enumerate(vals, 1):
                    cell = ws6.cell(row=r6, column=c, value=round(v, 4) if isinstance(v, float) else v)
                    cell.fill   = fill(bg)
                    cell.border = _border
                    cell.alignment = _right
                    cell.font   = _font(size=9)
                    if 2 <= c <= 9:
                        cell.number_format = "$#,##0.00"

            # Freeze header row
            ws6.freeze_panes = "A4"

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
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            SimpleDocTemplate, Table, TableStyle, Paragraph,
            Spacer, HRFlowable, KeepTogether, Image as RLImage,
        )
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

        W, H = A4
        margin = 1.6 * cm
        col_w = W - 2 * margin

        doc = SimpleDocTemplate(
            output_path, pagesize=A4,
            leftMargin=margin, rightMargin=margin,
            topMargin=margin, bottomMargin=margin,
        )
        styles = getSampleStyleSheet()

        # ── Colours ───────────────────────────────────────────────────────────
        NAVY      = colors.HexColor("#1B2A4A")
        BLUE      = colors.HexColor("#1E3A8A")
        BLUE_MID  = colors.HexColor("#2563EB")
        CYAN      = colors.HexColor("#0891B2")
        CYAN_LIGHT = colors.HexColor("#E0F7FA")
        ALT       = colors.HexColor("#EFF6FF")
        GREY      = colors.HexColor("#F8FAFC")
        WHITE     = colors.white
        DARK      = colors.HexColor("#1E293B")
        MUTED     = colors.HexColor("#64748B")
        GOLD      = colors.HexColor("#F59E0B")
        SUCCESS   = colors.HexColor("#059669")
        PURPLE    = colors.HexColor("#7C3AED")

        def _style(name, **kw):
            return ParagraphStyle(name, parent=styles["Normal"], **kw)

        s_title    = _style("T1", fontSize=22, textColor=WHITE,    fontName="Helvetica-Bold", spaceAfter=2)
        s_subtitle = _style("T2", fontSize=9,  textColor=colors.HexColor("#B0C4D8"), fontName="Helvetica", spaceAfter=0)
        s_h2       = _style("H2", fontSize=11, textColor=NAVY,     fontName="Helvetica-Bold", spaceBefore=14, spaceAfter=4)
        s_body     = _style("Bd", fontSize=8.5, textColor=DARK,    leading=12)
        s_kpi_lbl  = _style("KL", fontSize=8,  textColor=WHITE,    fontName="Helvetica-Bold", alignment=TA_CENTER)
        s_kpi_val  = _style("KV", fontSize=16, textColor=WHITE,    fontName="Helvetica-Bold", alignment=TA_CENTER)

        def _tbl_style(header_rows=1, nrows=0):
            ts = TableStyle([
                ('BACKGROUND',    (0, 0), (-1, header_rows - 1), BLUE_MID),
                ('TEXTCOLOR',     (0, 0), (-1, header_rows - 1), WHITE),
                ('FONTNAME',      (0, 0), (-1, header_rows - 1), 'Helvetica-Bold'),
                ('FONTSIZE',      (0, 0), (-1, -1), 8),
                ('GRID',          (0, 0), (-1, -1), 0.3, colors.HexColor("#CBD5E1")),
                ('LEFTPADDING',   (0, 0), (-1, -1), 6),
                ('RIGHTPADDING',  (0, 0), (-1, -1), 6),
                ('TOPPADDING',    (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
                ('ALIGN',         (1, 0), (-1, -1), 'RIGHT'),
                ('ALIGN',         (0, 0), (0, -1),  'LEFT'),
            ])
            if nrows > header_rows:
                for i in range(header_rows, nrows, 2):
                    ts.add('BACKGROUND', (0, i), (-1, i), ALT)
            return ts

        def _section_tbl(rows, cw=None):
            cw = cw or [col_w * 0.52, col_w * 0.48]
            n = len(rows)
            data = [[Paragraph(f"<b>{lbl}</b>", s_body), Paragraph(str(val), s_body)]
                    for lbl, val in rows]
            tbl = Table(data, colWidths=cw)
            tbl.setStyle(TableStyle([
                ('FONTSIZE',      (0, 0), (-1, -1), 8),
                ('GRID',          (0, 0), (-1, -1), 0.3, colors.HexColor("#CBD5E1")),
                ('LEFTPADDING',   (0, 0), (-1, -1), 6),
                ('RIGHTPADDING',  (0, 0), (-1, -1), 6),
                ('TOPPADDING',    (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
                ('ALIGN',         (1, 0), (-1, -1), 'RIGHT'),
                ('ALIGN',         (0, 0), (0, -1),  'LEFT'),
                *[('BACKGROUND', (0, i), (-1, i), ALT) for i in range(0, n, 2)],
            ]))
            return tbl

        def chart_img(png_bytes, width, height):
            return RLImage(io.BytesIO(png_bytes), width=width, height=height)

        story = []
        total     = results.get("total_cost", 0) or 1
        cpp       = results.get("cost_per_part", 0) or 0
        prod_run  = inputs.get("production_run", 1) or 1
        machine_name  = inputs.get("machine_name",  inputs.get("machine",  "–"))
        material_name = inputs.get("material_name", inputs.get("material", "–"))

        categories = [
            ("Material",               results.get("material",         {}).get("cost", 0)),
            ("Build Prep",             results.get("build_prep",       {}).get("cost", 0)),
            ("Machine Usage",          results.get("machine",          {}).get("cost", 0)),
            ("Consumables",            results.get("consumables",      {}).get("cost", 0)),
            ("Labor",                  results.get("labor",            {}).get("cost", 0)),
            ("Post-Process",           results.get("post_process",     {}).get("cost", 0)),
            ("Heat Treatment",         results.get("metal_am_extensions", {}).get("heat_treatment_cost", 0)),
            ("Part Separation",        results.get("metal_am_extensions", {}).get("part_separation_cost", 0)),
            ("HIP",                    results.get("metal_am_extensions", {}).get("hip_cost", 0)),
            ("Surface Treatment",      results.get("metal_am_extensions", {}).get("surface_treatment_cost", 0)),
            ("NDT / Inspection",       results.get("metal_am_extensions", {}).get("ndt_cost", 0)),
        ]
        active_cats = [(n, v) for n, v in categories if v and v > 0]

        # ── Cover banner ──────────────────────────────────────────────────────
        cover_data = [[
            Paragraph("Metal AM Cost Analysis Report", s_title),
            Paragraph(
                f"<b>Project:</b> {project_name}<br/>"
                f"<b>Machine:</b> {machine_name}<br/>"
                f"<b>Material:</b> {material_name}<br/>"
                f"<b>Generated:</b> {datetime.now().strftime('%B %d, %Y  %H:%M')}",
                s_subtitle
            )
        ]]
        cover_tbl = Table(cover_data, colWidths=[col_w * 0.58, col_w * 0.42])
        cover_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), NAVY),
            ('LEFTPADDING',   (0, 0), (-1, -1), 12),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 12),
            ('TOPPADDING',    (0, 0), (-1, -1), 16),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 16),
            ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(cover_tbl)
        story.append(Spacer(1, 8))

        # ── KPI cards ─────────────────────────────────────────────────────────
        kpi_colors = [BLUE_MID, NAVY, SUCCESS, PURPLE]
        kpis = [
            ("Cost per Part",   _c(cpp)),
            ("Total Run Cost",  _c(total)),
            ("Parts per Build", str(results.get("parts_per_build", "–"))),
            ("# of Builds",     str(results.get("num_builds", "–"))),
        ]
        kpi_rows = [
            [Paragraph(lbl, s_kpi_lbl) for lbl, _ in kpis],
            [Paragraph(val, s_kpi_val) for _, val in kpis],
        ]
        kpi_tbl = Table(kpi_rows, colWidths=[col_w / 4] * 4)
        kpi_style = TableStyle([
            ('LEFTPADDING',   (0, 0), (-1, -1), 8),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 8),
            ('TOPPADDING',    (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN',         (0, 0), (-1, -1), 'CENTER'),
            ('LINEBELOW',     (0, 1), (-1, 1), 3, GOLD),
        ])
        for i, c in enumerate(kpi_colors):
            kpi_style.add('BACKGROUND', (i, 0), (i, 1), c)
            kpi_style.add('TEXTCOLOR',  (i, 0), (i, 1), WHITE)
        kpi_tbl.setStyle(kpi_style)
        story.append(kpi_tbl)
        story.append(Spacer(1, 12))

        # ── Charts side-by-side ───────────────────────────────────────────────
        if active_cats:
            bar_png = _make_bar_chart(
                [n for n, _ in active_cats],
                [v for _, v in active_cats],
                title="Cost by Category ($)",
                figsize=(6.5, 2.8)
            )
            pie_png = _make_pie_chart(
                [n for n, _ in active_cats],
                [v for _, v in active_cats],
                title="Cost Distribution",
                figsize=(5, 2.8)
            )

            W_bar = col_w * 0.56
            W_pie = col_w * 0.42
            H_chart = 170

            if pie_png:
                charts_data = [[chart_img(bar_png, W_bar, H_chart), chart_img(pie_png, W_pie, H_chart)]]
                charts_tbl = Table(charts_data, colWidths=[W_bar + 4, W_pie])
                charts_tbl.setStyle(TableStyle([
                    ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
                    ('LEFTPADDING',   (0, 0), (-1, -1), 2),
                    ('RIGHTPADDING',  (0, 0), (-1, -1), 2),
                    ('BACKGROUND',    (0, 0), (-1, -1), colors.HexColor("#0f1623")),
                    ('ROUNDEDCORNERS', [4]),
                ]))
            else:
                charts_tbl = Table([[chart_img(bar_png, col_w, H_chart)]])
                charts_tbl.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#0f1623"))]))

            story.append(Paragraph("Cost Analysis Charts", s_h2))
            story.append(charts_tbl)
            story.append(Spacer(1, 10))

        # ── Quantity curve chart ───────────────────────────────────────────────
        if quantity_curve:
            qc_png = _make_line_chart(quantity_curve, current_qty=prod_run, figsize=(9.5, 3))
            if qc_png:
                story.append(Paragraph("Cost per Part vs Production Quantity", s_h2))
                qc_img = chart_img(qc_png, col_w, 180)
                qc_tbl = Table([[qc_img]], colWidths=[col_w])
                qc_tbl.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#0f1623"))]))
                story.append(qc_tbl)
                story.append(Spacer(1, 10))

        # ── Cost breakdown table ───────────────────────────────────────────────
        story.append(Paragraph("Cost Breakdown by Category", s_h2))
        bk_data = [["Category", "Total Cost", "Cost / Part", "% of Total"]]
        for cat, cost in active_cats:
            bk_data.append([cat, _c(cost), _c(cost / prod_run), _pct(cost, total)])
        bk_data.append(["TOTAL", _c(total), _c(cpp), "100%"])

        bk_tbl = Table(bk_data, colWidths=[col_w * 0.38, col_w * 0.22, col_w * 0.22, col_w * 0.18])
        bk_style = _tbl_style(nrows=len(bk_data))
        last = len(bk_data) - 1
        bk_style.add('BACKGROUND', (0, last), (-1, last), NAVY)
        bk_style.add('TEXTCOLOR',  (0, last), (-1, last), WHITE)
        bk_style.add('FONTNAME',   (0, last), (-1, last), 'Helvetica-Bold')
        bk_tbl.setStyle(bk_style)
        story.append(KeepTogether([bk_tbl]))
        story.append(Spacer(1, 10))

        # ── Machine time breakdown ─────────────────────────────────────────────
        mach_r = results.get("machine", {})
        story.append(Paragraph("Machine Time Breakdown", s_h2))
        time_data = [
            ["Phase",          "Time (hr)", "Notes"],
            ["Warmup",         _f(mach_r.get("total_warmup_hr", 0), 2),        f"{results.get('num_builds', 0)} builds × warmup"],
            ["Laser Scan",     _f(mach_r.get("total_scan_hr", 0), 2),          "Deposition time only"],
            ["Recoating",      _f(mach_r.get("total_recoating_hr", 0), 2),     "Powder spreading overhead"],
            ["Cooldown",       _f(mach_r.get("total_cooldown_hr", 0), 2),      f"{results.get('num_builds', 0)} builds × cooldown"],
            ["Build Exchange", _f(mach_r.get("total_build_exchange_hr", 0), 2), "Setup + removal"],
            ["TOTAL",          _f(mach_r.get("total_machine_time_hr", 0), 2),  ""],
        ]
        t3 = Table(time_data, colWidths=[col_w * 0.28, col_w * 0.2, col_w * 0.52])
        s3 = _tbl_style(nrows=len(time_data))
        l3 = len(time_data) - 1
        s3.add('BACKGROUND', (0, l3), (-1, l3), NAVY)
        s3.add('TEXTCOLOR',  (0, l3), (-1, l3), WHITE)
        s3.add('FONTNAME',   (0, l3), (-1, l3), 'Helvetica-Bold')
        t3.setStyle(s3)
        story.append(KeepTogether([t3]))
        story.append(Spacer(1, 10))

        # ── Two-column layout: Material + Part/Production ─────────────────────
        mat_r = results.get("material", {})
        story.append(Paragraph("Material & Part Details", s_h2))

        mat_rows = [
            ("Total Part Material",    _f(mat_r.get("total_part_material_kg", 0), 3, " kg")),
            ("Total Support Material", _f(mat_r.get("total_support_material_kg", 0), 3, " kg")),
            ("Net Material Required",  _f(mat_r.get("material_required_kg", 0), 3, " kg")),
            ("Powder Recycled",        _f(mat_r.get("recycled_material_kg", 0), 3, " kg")),
            ("Material Waste",         _f(mat_r.get("material_waste_kg", 0), 3, " kg")),
            ("Material Cost",          _c(mat_r.get("cost", 0))),
        ]
        part_rows = [
            ("Part File",              inputs.get("part_file_name", "–")),
            ("Volume",                 _f(inputs.get("part_volume_cm3"), 3, " cm³")),
            ("Height (build dir.)",    _f((inputs.get("part_height_cm") or 0) * 10, 2, " mm")),
            ("Mass",                   _f(inputs.get("part_mass_kg"), 4, " kg")),
            ("Support Fraction",       _f((inputs.get("support_pct_of_mass") or 0) * 100, 1, "%")),
            ("Production Run",         f"{prod_run:,} parts"),
        ]
        half = col_w / 2 - 3
        two_col = Table(
            [[_section_tbl(mat_rows, [half * 0.52, half * 0.48]),
              _section_tbl(part_rows, [half * 0.52, half * 0.48])]],
            colWidths=[half + 6, half]
        )
        two_col.setStyle(TableStyle([
            ('VALIGN',       (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING',  (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ]))
        story.append(KeepTogether([two_col]))
        story.append(Spacer(1, 10))

        # ── Machine & Process ─────────────────────────────────────────────────
        story.append(Paragraph("Machine & Process Configuration", s_h2))
        machine_rows = [
            ("Machine Name",         inputs.get("machine_name", "–")),
            ("Manufacturer",         inputs.get("machine_manufacturer", "–")),
            ("Build Plate",          inputs.get("machine_build_plate", "–")),
            ("Build Height",         _f(inputs.get("machine_build_height_mm"), 0, " mm")),
            ("Build Area",           _f(inputs.get("machine_build_area_cm2"), 1, " cm²")),
            ("Machine Cost",         _c(inputs.get("machine_cost_usd", 0))),
            ("Number of Lasers",     str(inputs.get("machine_num_lasers", 1))),
            ("Laser Strategy",       inputs.get("laser_strategy", "single")),
            ("Recoating Efficiency", _f((inputs.get("recoating_efficiency") or 0.75) * 100, 0, "%")),
            ("Material Build Rate",  _f(inputs.get("material_build_rate_cm3_hr"), 1, " cm³/hr")),
            ("Layer Thickness",      _f(inputs.get("layer_thickness_um"), 0, " µm")),
            ("Packing Policy",       inputs.get("machine_packing_policy", "2D")),
            ("Packing Fraction",     _f((inputs.get("machine_packing_fraction") or 0.9) * 100, 0, "%")),
        ]
        story.append(KeepTogether([_section_tbl(machine_rows)]))
        story.append(Spacer(1, 10))

        # ── Quantity curve table ───────────────────────────────────────────────
        if quantity_curve:
            story.append(Paragraph("Cost vs Quantity (selected data points)", s_h2))
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
            qt = Table(qc_data, colWidths=[col_w * 0.12, col_w * 0.22, col_w * 0.24, col_w * 0.22, col_w * 0.20])
            qt.setStyle(_tbl_style(nrows=len(qc_data)))
            story.append(KeepTogether([qt]))

        doc.build(story)
        return output_path
    except Exception as e:
        raise Exception(f"PDF export failed: {str(e)}")
