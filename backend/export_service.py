import os
import json
from datetime import datetime
from typing import Optional


def export_to_excel(project_name: str, inputs: dict, results: dict, output_path: str) -> str:
    """Export cost analysis to Excel file."""
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter

        wb = Workbook()
        ws = wb.active
        ws.title = "Cost Analysis"

        # Header
        ws['A1'] = "Metal AM Cost Analysis"
        ws['A1'].font = Font(bold=True, size=16)
        ws['A2'] = f"Project: {project_name}"
        ws['A3'] = f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}"

        # Cost Summary
        ws['A5'] = "COST SUMMARY"
        ws['A5'].font = Font(bold=True, size=12)

        cost_data = [
            ("Total Cost", results.get("total_cost", 0)),
            ("Cost per Part", results.get("cost_per_part", 0)),
            ("Production Run", inputs.get("production_run", 0)),
            ("Parts per Build", results.get("parts_per_build", 0)),
            ("Number of Builds", results.get("num_builds", 0)),
        ]

        for i, (label, value) in enumerate(cost_data, start=6):
            ws[f'A{i}'] = label
            ws[f'B{i}'] = f"${value:,.2f}" if isinstance(value, float) else value

        # Cost Breakdown
        ws['A12'] = "COST BREAKDOWN"
        ws['A12'].font = Font(bold=True, size=12)

        ws['A13'] = "Category"
        ws['B13'] = "Cost ($)"
        ws['C13'] = "% of Total"
        ws['A13'].font = Font(bold=True)
        ws['B13'].font = Font(bold=True)
        ws['C13'].font = Font(bold=True)

        total = results.get("total_cost", 1)
        categories = [
            ("Material",          results.get("material", {}).get("cost", 0)),
            ("Build Preparation", results.get("build_prep", {}).get("cost", 0)),
            ("Machine Usage",     results.get("machine", {}).get("cost", 0)),
            ("Consumables",       results.get("consumables", {}).get("cost", 0)),
            ("Labor",             results.get("labor", {}).get("cost", 0)),
            ("Post-Process",      results.get("post_process", {}).get("cost", 0)),
            ("Heat Treatment",    results.get("metal_am_extensions", {}).get("heat_treatment_cost", 0)),
            ("Part Separation",   results.get("metal_am_extensions", {}).get("part_separation_cost", 0)),
            ("HIP",               results.get("metal_am_extensions", {}).get("hip_cost", 0)),
            ("Surface Treatment", results.get("metal_am_extensions", {}).get("surface_treatment_cost", 0)),
            ("NDT/Inspection",    results.get("metal_am_extensions", {}).get("ndt_cost", 0)),
        ]

        for i, (category, cost) in enumerate(categories, start=14):
            ws[f'A{i}'] = category
            ws[f'B{i}'] = round(cost, 2)
            ws[f'C{i}'] = f"{cost / total * 100:.1f}%" if total > 0 else "0%"

        # Column widths
        ws.column_dimensions['A'].width = 25
        ws.column_dimensions['B'].width = 18
        ws.column_dimensions['C'].width = 14

        wb.save(output_path)
        return output_path
    except Exception as e:
        raise Exception(f"Excel export failed: {str(e)}")


def export_to_pdf(project_name: str, inputs: dict, results: dict, output_path: str) -> str:
    """Export cost analysis to PDF file."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER

        doc = SimpleDocTemplate(output_path, pagesize=A4)
        styles = getSampleStyleSheet()
        story = []

        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Title'],
            fontSize=20,
            spaceAfter=20
        )
        story.append(Paragraph("Metal AM Cost Analysis Report", title_style))
        story.append(Paragraph(f"Project: {project_name}", styles['Heading2']))
        story.append(
            Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal'])
        )
        story.append(Spacer(1, 20))

        # Cost Summary Table
        story.append(Paragraph("Cost Summary", styles['Heading2']))

        total = results.get("total_cost", 0)
        cpp = results.get("cost_per_part", 0)

        summary_data = [
            ["Metric", "Value"],
            ["Total Run Cost",   f"${total:,.2f}"],
            ["Cost per Part",    f"${cpp:,.2f}"],
            ["Production Run",   str(inputs.get("production_run", 0))],
            ["Parts per Build",  str(results.get("parts_per_build", 0))],
            ["Number of Builds", str(results.get("num_builds", 0))],
        ]

        summary_table = Table(summary_data, colWidths=[3 * inch, 3 * inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
            ('TEXTCOLOR',  (0, 0), (-1, 0), colors.white),
            ('FONTNAME',   (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID',       (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 20))

        # Cost Breakdown Table
        story.append(Paragraph("Cost Breakdown", styles['Heading2']))

        categories = [
            ("Material",          results.get("material", {}).get("cost", 0)),
            ("Build Preparation", results.get("build_prep", {}).get("cost", 0)),
            ("Machine Usage",     results.get("machine", {}).get("cost", 0)),
            ("Consumables",       results.get("consumables", {}).get("cost", 0)),
            ("Labor",             results.get("labor", {}).get("cost", 0)),
            ("Post-Process",      results.get("post_process", {}).get("cost", 0)),
            ("Heat Treatment",    results.get("metal_am_extensions", {}).get("heat_treatment_cost", 0)),
            ("Part Separation",   results.get("metal_am_extensions", {}).get("part_separation_cost", 0)),
            ("HIP",               results.get("metal_am_extensions", {}).get("hip_cost", 0)),
            ("Surface Treatment", results.get("metal_am_extensions", {}).get("surface_treatment_cost", 0)),
            ("NDT/Inspection",    results.get("metal_am_extensions", {}).get("ndt_cost", 0)),
        ]

        breakdown_data = [["Category", "Cost ($)", "% of Total"]]
        for cat, cost in categories:
            if cost > 0:
                breakdown_data.append([
                    cat,
                    f"${cost:,.2f}",
                    f"{cost / total * 100:.1f}%" if total > 0 else "0%"
                ])

        breakdown_table = Table(breakdown_data, colWidths=[3 * inch, 2 * inch, 2 * inch])
        breakdown_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
            ('TEXTCOLOR',  (0, 0), (-1, 0), colors.white),
            ('FONTNAME',   (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID',       (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ]))
        story.append(breakdown_table)

        doc.build(story)
        return output_path
    except Exception as e:
        raise Exception(f"PDF export failed: {str(e)}")
