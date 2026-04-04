"""
AM Cost Model — Methodology & Case Study PDF Generator
Uses ReportLab to produce a fully-styled, professional PDF.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.platypus.flowables import Flowable
from reportlab.lib.colors import HexColor
import os

# ── Palette ────────────────────────────────────────────────────────────────
NAVY       = HexColor("#0D1B2A")   # deep navy — background / heavy headers
SLATE      = HexColor("#1E2E45")   # mid-navy — section header bars
STEEL      = HexColor("#2E4A6A")   # accent bars, table header
CYAN       = HexColor("#00B4D8")   # highlight / accent text
LIGHT_CYAN = HexColor("#CAF0F8")   # table alt-row tint
AMBER      = HexColor("#F59E0B")   # call-out / key number accent
WHITE      = colors.white
OFF_WHITE  = HexColor("#F8FAFC")
LIGHT_GRAY = HexColor("#E2E8F0")
MID_GRAY   = HexColor("#94A3B8")
DARK_TEXT  = HexColor("#1E293B")
BODY_TEXT  = HexColor("#334155")

PAGE_W, PAGE_H = A4
MARGIN = 20 * mm


# ── Custom Flowables ────────────────────────────────────────────────────────

class ColorBar(Flowable):
    """A solid coloured rectangle — used as section dividers / header bars."""
    def __init__(self, width, height, color, radius=0):
        super().__init__()
        self.bar_width  = width
        self.bar_height = height
        self.color      = color
        self.radius     = radius

    def wrap(self, *args):
        return self.bar_width, self.bar_height

    def draw(self):
        self.canv.setFillColor(self.color)
        if self.radius:
            self.canv.roundRect(0, 0, self.bar_width, self.bar_height, self.radius, fill=1, stroke=0)
        else:
            self.canv.rect(0, 0, self.bar_width, self.bar_height, fill=1, stroke=0)


class SectionHeader(Flowable):
    """Full-width navy bar with white title text and a cyan left accent."""
    def __init__(self, text, width, number=None):
        super().__init__()
        self.text    = text
        self.number  = number
        self.s_width = width
        self.height  = 14 * mm

    def wrap(self, *args):
        return self.s_width, self.height

    def draw(self):
        c = self.canv
        h = self.height
        w = self.s_width

        # Background
        c.setFillColor(SLATE)
        c.roundRect(0, 0, w, h, 3, fill=1, stroke=0)

        # Cyan left accent strip
        c.setFillColor(CYAN)
        c.roundRect(0, 0, 5, h, 2, fill=1, stroke=0)

        # Number badge
        x = 12 * mm
        if self.number:
            c.setFillColor(CYAN)
            c.circle(x - 3*mm, h/2, 3.5*mm, fill=1, stroke=0)
            c.setFillColor(NAVY)
            c.setFont("Helvetica-Bold", 8)
            c.drawCentredString(x - 3*mm, h/2 - 2.5, self.number)
            x += 4 * mm

        # Title
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(x, h/2 - 4.5, self.text)


class KPIBox(Flowable):
    """Highlighted KPI card — value in amber, label in gray."""
    def __init__(self, label, value, width=40*mm, height=18*mm):
        super().__init__()
        self.label  = label
        self.value  = value
        self.kwidth = width
        self.kheight = height

    def wrap(self, *args):
        return self.kwidth, self.kheight

    def draw(self):
        c = self.canv
        w, h = self.kwidth, self.kheight
        c.setFillColor(NAVY)
        c.roundRect(0, 0, w, h, 4, fill=1, stroke=0)
        c.setFillColor(CYAN)
        c.setLineWidth(0.8)
        c.setStrokeColor(CYAN)
        c.roundRect(0, 0, w, h, 4, fill=0, stroke=1)
        # Value
        c.setFillColor(AMBER)
        c.setFont("Helvetica-Bold", 11)
        c.drawCentredString(w/2, h - 7*mm, self.value)
        # Label
        c.setFillColor(MID_GRAY)
        c.setFont("Helvetica", 6.5)
        c.drawCentredString(w/2, 3*mm, self.label)


def make_kpi_row(items, content_width):
    """Lay out a row of KPIBox items using a Table so they're evenly spaced."""
    col_w = content_width / len(items)
    cells = [[KPIBox(label, value, width=col_w - 4*mm, height=18*mm) for label, value in items]]
    t = Table(cells, colWidths=[col_w]*len(items))
    t.setStyle(TableStyle([
        ("ALIGN",    (0,0), (-1,-1), "CENTER"),
        ("VALIGN",   (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING",  (0,0), (-1,-1), 2),
        ("RIGHTPADDING", (0,0), (-1,-1), 2),
    ]))
    return t


# ── Style helpers ───────────────────────────────────────────────────────────

def build_styles():
    base = getSampleStyleSheet()
    styles = {}

    styles["body"] = ParagraphStyle(
        "body", parent=base["Normal"],
        fontSize=9, leading=14, textColor=BODY_TEXT,
        fontName="Helvetica", alignment=TA_LEFT,
        spaceBefore=2, spaceAfter=2,
    )
    styles["body_justify"] = ParagraphStyle(
        "body_justify", parent=styles["body"], alignment=TA_JUSTIFY,
    )
    styles["caption"] = ParagraphStyle(
        "caption", parent=styles["body"],
        fontSize=7.5, textColor=MID_GRAY, leading=11,
    )
    styles["h3"] = ParagraphStyle(
        "h3", parent=base["Normal"],
        fontSize=10, leading=14, textColor=STEEL,
        fontName="Helvetica-Bold", spaceBefore=6, spaceAfter=3,
    )
    styles["cyan_label"] = ParagraphStyle(
        "cyan_label", parent=styles["body"],
        fontSize=8, textColor=CYAN, fontName="Helvetica-Bold",
    )
    styles["code"] = ParagraphStyle(
        "code", parent=base["Normal"],
        fontSize=8, leading=12, textColor=HexColor("#22D3EE"),
        fontName="Courier", backColor=NAVY,
        leftIndent=6, rightIndent=6, spaceBefore=4, spaceAfter=4,
        borderPad=6,
    )
    styles["formula_label"] = ParagraphStyle(
        "formula_label", parent=styles["body"],
        fontSize=7.5, textColor=MID_GRAY, leftIndent=6,
    )
    styles["callout"] = ParagraphStyle(
        "callout", parent=styles["body"],
        fontSize=9, leading=13, textColor=AMBER,
        fontName="Helvetica-BoldOblique",
        leftIndent=8,
    )
    styles["result_line"] = ParagraphStyle(
        "result_line", parent=styles["body"],
        fontSize=10, textColor=WHITE, fontName="Helvetica-Bold",
        alignment=TA_CENTER,
    )
    styles["toc_entry"] = ParagraphStyle(
        "toc_entry", parent=styles["body"],
        fontSize=9, textColor=LIGHT_GRAY, leading=16,
    )
    return styles


# ── Table builders ──────────────────────────────────────────────────────────

HEADER_TS = TableStyle([
    ("BACKGROUND",    (0, 0), (-1, 0), STEEL),
    ("TEXTCOLOR",     (0, 0), (-1, 0), WHITE),
    ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE",      (0, 0), (-1, 0), 8),
    ("ROWBACKGROUNDS",(0, 1), (-1, -1), [OFF_WHITE, LIGHT_CYAN]),
    ("FONTNAME",      (0, 1), (-1, -1), "Helvetica"),
    ("FONTSIZE",      (0, 1), (-1, -1), 8),
    ("TEXTCOLOR",     (0, 1), (-1, -1), DARK_TEXT),
    ("GRID",          (0, 0), (-1, -1), 0.4, LIGHT_GRAY),
    ("TOPPADDING",    (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ("LEFTPADDING",   (0, 0), (-1, -1), 6),
    ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
    ("ALIGN",         (1, 1), (-1, -1), "RIGHT"),
    ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
])


def plain_table(data, col_widths, highlight_last=False, right_cols=None):
    t = Table(data, colWidths=col_widths)
    ts = TableStyle(list(HEADER_TS._cmds))
    if highlight_last:
        last = len(data) - 1
        ts.add("BACKGROUND",  (0, last), (-1, last), STEEL)
        ts.add("TEXTCOLOR",   (0, last), (-1, last), WHITE)
        ts.add("FONTNAME",    (0, last), (-1, last), "Helvetica-Bold")
        ts.add("FONTSIZE",    (0, last), (-1, last), 9)
    if right_cols:
        for col in right_cols:
            ts.add("ALIGN", (col, 0), (col, -1), "RIGHT")
    t.setStyle(ts)
    return t


# ── Page template ────────────────────────────────────────────────────────────

def on_page(canvas, doc):
    """Header and footer on every page except the cover."""
    if doc.page == 1:
        return
    w, h = A4
    canvas.saveState()

    # Top bar
    canvas.setFillColor(NAVY)
    canvas.rect(0, h - 10*mm, w, 10*mm, fill=1, stroke=0)
    canvas.setFillColor(CYAN)
    canvas.rect(0, h - 10*mm, 3, 10*mm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica-Bold", 7.5)
    canvas.drawString(MARGIN, h - 6.5*mm, "AM Cost Model — Methodology & Case Study")
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(MID_GRAY)
    canvas.drawRightString(w - MARGIN, h - 6.5*mm, "Confidential")

    # Bottom bar
    canvas.setFillColor(SLATE)
    canvas.rect(0, 0, w, 7*mm, fill=1, stroke=0)
    canvas.setFillColor(MID_GRAY)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(MARGIN, 2.5*mm, "Additive Manufacturing Cost Calculator")
    canvas.setFillColor(CYAN)
    canvas.setFont("Helvetica-Bold", 7)
    canvas.drawRightString(w - MARGIN, 2.5*mm, f"Page {doc.page}")

    canvas.restoreState()


# ── Cover page ───────────────────────────────────────────────────────────────

def cover_page(content_width):
    elems = []
    w = content_width

    elems.append(Spacer(1, 18*mm))

    # Decorative top stripe
    elems.append(ColorBar(w, 3*mm, CYAN, radius=2))
    elems.append(Spacer(1, 6*mm))

    # Title block
    title_data = [
        [Paragraph(
            '<font color="#00B4D8" size="22"><b>Additive Manufacturing</b></font><br/>'
            '<font color="#FFFFFF" size="28"><b>Cost Model</b></font>',
            ParagraphStyle("ct", fontName="Helvetica-Bold", alignment=TA_LEFT,
                           textColor=WHITE, leading=34, fontSize=28)
        )]
    ]
    t = Table(title_data, colWidths=[w])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,-1), NAVY),
        ("LEFTPADDING",  (0,0), (-1,-1), 10),
        ("TOPPADDING",   (0,0), (-1,-1), 12),
        ("BOTTOMPADDING",(0,0), (-1,-1), 12),
        ("ROUNDEDCORNERS", (0,0), (-1,-1), [4,4,4,4]),
    ]))
    elems.append(t)

    elems.append(Spacer(1, 4*mm))

    subtitle_data = [[
        Paragraph(
            '<font color="#CAF0F8" size="14"><b>Methodology, Formula Reference &amp; Case Study</b></font>',
            ParagraphStyle("sub", fontName="Helvetica", alignment=TA_LEFT,
                           textColor=LIGHT_CYAN, fontSize=14, leading=20)
        )
    ]]
    st = Table(subtitle_data, colWidths=[w])
    st.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,-1), SLATE),
        ("LEFTPADDING",  (0,0), (-1,-1), 10),
        ("TOPPADDING",   (0,0), (-1,-1), 8),
        ("BOTTOMPADDING",(0,0), (-1,-1), 8),
    ]))
    elems.append(st)
    elems.append(Spacer(1, 10*mm))

    # KPI row
    elems.append(make_kpi_row([
        ("Cost Categories", "7"),
        ("Process Steps", "6+"),
        ("Extension Modules", "5"),
        ("Quantity Curve Points", "500"),
    ], w))

    elems.append(Spacer(1, 10*mm))

    # Description box
    desc_style = ParagraphStyle("desc", fontName="Helvetica", fontSize=9.5,
                                textColor=LIGHT_GRAY, leading=16, alignment=TA_JUSTIFY)
    desc_data = [[
        Paragraph(
            "This document describes the complete cost estimation methodology used by the AM Cost Calculator. "
            "It covers how each cost driver is modelled — from machine depreciation and powder consumption "
            "to support removal labour — and walks through a fully worked case study for a 316L stainless "
            "steel medical impeller produced in a batch of 100 parts via Laser Powder Bed Fusion (LPBF). "
            "Intended for program managers, procurement teams, and business stakeholders who need to "
            "understand and validate cost estimates without a background in additive manufacturing.",
            desc_style
        )
    ]]
    dt = Table(desc_data, colWidths=[w])
    dt.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,-1), NAVY),
        ("LEFTPADDING",  (0,0), (-1,-1), 10),
        ("TOPPADDING",   (0,0), (-1,-1), 10),
        ("BOTTOMPADDING",(0,0), (-1,-1), 10),
        ("LINEABOVE",    (0,0), (-1,0), 2, CYAN),
        ("LINEBELOW",    (0,-1), (-1,-1), 1, STEEL),
    ]))
    elems.append(dt)

    elems.append(Spacer(1, 12*mm))

    # Meta row
    meta_data = [[
        Paragraph('<font color="#94A3B8" size="8">Version</font><br/>'
                  '<font color="#FFFFFF" size="9"><b>1.0</b></font>',
                  ParagraphStyle("m", fontName="Helvetica", alignment=TA_CENTER, leading=13)),
        Paragraph('<font color="#94A3B8" size="8">Date</font><br/>'
                  '<font color="#FFFFFF" size="9"><b>April 2026</b></font>',
                  ParagraphStyle("m", fontName="Helvetica", alignment=TA_CENTER, leading=13)),
        Paragraph('<font color="#94A3B8" size="8">Classification</font><br/>'
                  '<font color="#FFFFFF" size="9"><b>Business Use</b></font>',
                  ParagraphStyle("m", fontName="Helvetica", alignment=TA_CENTER, leading=13)),
        Paragraph('<font color="#94A3B8" size="8">Process</font><br/>'
                  '<font color="#FFFFFF" size="9"><b>LPBF Metal AM</b></font>',
                  ParagraphStyle("m", fontName="Helvetica", alignment=TA_CENTER, leading=13)),
    ]]
    mt = Table(meta_data, colWidths=[w/4]*4)
    mt.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,-1), SLATE),
        ("TOPPADDING",   (0,0), (-1,-1), 8),
        ("BOTTOMPADDING",(0,0), (-1,-1), 8),
        ("VALIGN",       (0,0), (-1,-1), "MIDDLE"),
        ("LINEAFTER",    (0,0), (2,-1), 0.4, STEEL),
    ]))
    elems.append(mt)

    elems.append(Spacer(1, 8*mm))
    elems.append(ColorBar(w, 2*mm, CYAN, radius=1))

    elems.append(PageBreak())
    return elems


# ── Content builders ─────────────────────────────────────────────────────────

def section(title, number, content_width, S):
    return KeepTogether([
        Spacer(1, 4*mm),
        SectionHeader(title, content_width, number=number),
        Spacer(1, 3*mm),
    ])


def code_block(text, S):
    lines = text.strip().split("\n")
    rows = [[Paragraph(line if line.strip() else " ", S["code"])] for line in lines]
    t = Table(rows, colWidths=["100%"])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,-1), NAVY),
        ("LEFTPADDING",  (0,0), (-1,-1), 8),
        ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING",   (0,0), (-1,-1), 1),
        ("BOTTOMPADDING",(0,0), (-1,-1), 1),
        ("LINEAFTER",    (0,0), (0,-1), 3, CYAN),
    ]))
    return t


def result_box(text, content_width, S):
    data = [[Paragraph(f'<font color="#F59E0B"><b>{text}</b></font>',
                       ParagraphStyle("rb", fontName="Helvetica-Bold", fontSize=10.5,
                                      alignment=TA_CENTER, textColor=AMBER, leading=14))]]
    t = Table(data, colWidths=[content_width])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,-1), NAVY),
        ("LINEABOVE",    (0,0), (-1,0), 2, AMBER),
        ("LINEBELOW",    (0,-1), (-1,-1), 2, AMBER),
        ("TOPPADDING",   (0,0), (-1,-1), 7),
        ("BOTTOMPADDING",(0,0), (-1,-1), 7),
    ]))
    return t


def insight_box(text, content_width, S):
    data = [[
        Paragraph("▶", ParagraphStyle("arr", fontName="Helvetica-Bold", fontSize=12,
                                       textColor=CYAN, alignment=TA_CENTER)),
        Paragraph(text, ParagraphStyle("ib", fontName="Helvetica-Oblique", fontSize=8.5,
                                        textColor=LIGHT_CYAN, leading=13))
    ]]
    t = Table(data, colWidths=[10*mm, content_width - 10*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,-1), SLATE),
        ("TOPPADDING",   (0,0), (-1,-1), 6),
        ("BOTTOMPADDING",(0,0), (-1,-1), 6),
        ("LEFTPADDING",  (0,0), (-1,-1), 6),
        ("VALIGN",       (0,0), (-1,-1), "MIDDLE"),
        ("LINEAFTER",    (0,0), (0,-1), 2, CYAN),
    ]))
    return t


# ── Main document builder ────────────────────────────────────────────────────

def build_pdf(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=14*mm,
        bottomMargin=12*mm,
        title="AM Cost Model — Methodology & Case Study",
        author="AM Cost Calculator",
    )
    content_width = PAGE_W - 2 * MARGIN
    S = build_styles()
    elems = []

    # ── COVER ────────────────────────────────────────────────────────────────
    elems += cover_page(content_width)

    # ── SECTION 1 — What This Tool Does ─────────────────────────────────────
    elems.append(section("What This Tool Does", "1", content_width, S))

    elems.append(Paragraph(
        "This calculator estimates the total and per-part cost of producing metal parts using "
        "<b>Laser Powder Bed Fusion (LPBF)</b> — the most widely used industrial metal additive "
        "manufacturing process. The methodology follows the framework developed at MIT and used "
        "by leading AM cost researchers, adapted for real-world production planning.",
        S["body_justify"]
    ))
    elems.append(Spacer(1, 4*mm))

    input_data = [
        ["Input Type", "What It Captures"],
        ["Part Geometry", "Size, volume, height, support structures — from a 3D file or manual entry"],
        ["Machine & Facility", "Which printer, its capital cost, operating schedule, staffing model"],
        ["Material", "Powder type, cost per kilogram, density, layer thickness"],
    ]
    elems.append(plain_table(input_data, [55*mm, content_width - 55*mm]))
    elems.append(Spacer(1, 5*mm))

    elems.append(Paragraph(
        "The tool computes cost across <b>seven distinct categories</b>, each described in detail below.",
        S["body"]
    ))

    # ── SECTION 2 — The Process ──────────────────────────────────────────────
    elems.append(section("The LPBF Process — Step by Step", "2", content_width, S))

    steps = [
        ("1. Powder spreading", "A thin metal powder layer (30–60 µm, ~width of a human hair) is spread across the build plate by a recoater blade."),
        ("2. Laser melting", "One or more laser beams selectively melt the powder, tracing each part's cross-section for that layer."),
        ("3. Layer repeat", "The build plate drops by one layer thickness. Steps 1–2 repeat thousands of times."),
        ("4. Cool-down", "After the final layer, the machine undergoes a controlled cooling phase to prevent distortion."),
        ("5. Part removal", "The build plate is removed and parts are separated (wire EDM or sawing)."),
        ("6. Post-processing", "Support structures are manually removed. Optional: heat treatment, HIP, surface finishing, NDT inspection."),
    ]
    step_data = [["Phase", "Description"]] + steps
    elems.append(plain_table(step_data, [42*mm, content_width - 42*mm]))
    elems.append(Spacer(1, 3*mm))
    elems.append(insight_box(
        "Every one of these steps carries a cost. The model accounts for all of them — "
        "including machine time during cool-down, operator time during changeover, and "
        "technician time removing supports after the build.",
        content_width, S
    ))

    # ── SECTION 3 — Cost Categories ──────────────────────────────────────────
    elems.append(section("Cost Categories & Formulas", "3", content_width, S))

    elems.append(Paragraph(
        "The total cost is the sum of seven categories. Each is calculated independently "
        "and can be inspected in the tool's results breakdown.",
        S["body"]
    ))
    elems.append(Spacer(1, 3*mm))

    cat_data = [
        ["#", "Category", "Primary Driver", "Typical Share"],
        ["1", "Material",         "Part volume, powder price, recycling rate",        "10–20%"],
        ["2", "Build Preparation","Number of builds, engineer salary",                "3–6%"],
        ["3", "Machine Usage",    "Machine hourly rate × total machine hours",        "20–35%"],
        ["4", "Consumables",      "Inert gas duration, per-build supplies",           "4–8%"],
        ["5", "Labor",            "Operator supervision + build changeover time",     "8–15%"],
        ["6", "Support Removal",  "Part geometry complexity, technician rate",        "15–30%"],
        ["7", "Extensions",       "Heat treatment, part separation, HIP, NDT",       "0–25%"],
    ]
    elems.append(plain_table(cat_data, [10*mm, 48*mm, 85*mm, content_width - 143*mm]))
    elems.append(Spacer(1, 5*mm))

    # --- Cat 1: Material
    elems.append(KeepTogether([
        Paragraph("3.1  Material", S["h3"]),
        Paragraph(
            "The recoater spreads powder over the <i>entire</i> build plate for every layer — "
            "not just where parts sit. Most unfused powder is recycled, but a fraction degrades and becomes waste.",
            S["body_justify"]
        ),
        Spacer(1, 2*mm),
        code_block(
            "Powder deposited  =  Num builds × Build plate area × Part height × Powder density\n"
            "Unfused powder    =  Powder deposited − Part material − Support material\n"
            "Material waste    =  Unfused powder × (1 − Recycling fraction)\n"
            "Material purchased=  Part material + Support material + Material waste\n"
            "Material cost     =  Material purchased × Cost per kg",
            S
        ),
        Spacer(1, 2*mm),
        insight_box(
            "A large build plate with few small parts wastes a disproportionate amount of powder. "
            "Filling the build plate efficiently is the single most effective way to reduce material cost.",
            content_width, S
        ),
        Spacer(1, 4*mm),
    ]))

    # --- Cat 2: Build Prep
    elems.append(KeepTogether([
        Paragraph("3.2  Build Preparation", S["h3"]),
        Paragraph(
            "An engineer sets up each build: orienting parts, generating supports, slicing the file, "
            "and configuring process parameters. The first build takes longer due to full process verification.",
            S["body_justify"]
        ),
        Spacer(1, 2*mm),
        code_block(
            "Prep time  =  First build time  +  (Num builds − 1) × Subsequent build time\n"
            "Cost       =  Prep time × Engineer hourly rate",
            S
        ),
        Spacer(1, 4*mm),
    ]))

    # --- Cat 3: Machine
    elems.append(KeepTogether([
        Paragraph("3.3  Machine Usage", S["h3"]),
        Paragraph(
            "Machine cost is converted from a capital purchase into an hourly rate using the "
            "<b>equivalent annual cost (EAC)</b> method — standard engineering economics practice. "
            "The hourly rate is then multiplied by total machine-on time across all builds.",
            S["body_justify"]
        ),
        Spacer(1, 2*mm),
        code_block(
            "Annual depreciation  =  (CoC × Purchase price × Infrastructure factor)\n"
            "                        ÷ (1 − (1 + CoC)^(−Lifetime years))\n\n"
            "Annual maintenance   =  Purchase price × Maintenance %\n\n"
            "Machine $/hr         =  (Depreciation + Maintenance)\n"
            "                        ÷ (Hrs/day × Days/wk × 52 × Uptime %)\n\n"
            "Machine cost         =  Total machine time × Machine $/hr",
            S
        ),
        Spacer(1, 2*mm),
    ]))

    time_data = [
        ["Time Phase", "Formula", "Notes"],
        ["Warm-up",       "Num builds × Warm-up hr/build",                          "Machine heats before each build"],
        ["Laser scanning","Production run × Volume × (1+Support%) ÷ (Rate × Lasers)","Scales with material volume & laser count"],
        ["Recoating",     "Scan time × (1/Recoating efficiency − 1)",               "Overhead between laser passes"],
        ["Cool-down",     "Num builds × Cooldown hr/build",                         "Controlled cooling to prevent distortion"],
        ["Build exchange","Num builds × (Setup + Removal) hr/build",                "Plate swap between builds"],
    ]
    elems.append(plain_table(time_data, [30*mm, 75*mm, content_width - 105*mm]))
    elems.append(Spacer(1, 4*mm))

    # --- Cat 4: Consumables
    elems.append(KeepTogether([
        Paragraph("3.4  Consumables", S["h3"]),
        Paragraph(
            "Inert gas (argon or nitrogen) continuously purges the build chamber to prevent metal oxidation. "
            "Per-build supplies include filters, recoater blades, and build platform material.",
            S["body_justify"]
        ),
        Spacer(1, 2*mm),
        code_block(
            "Inert gas cost    =  Gas $/hr × (Warm-up + Print + Cool-down time)\n"
            "Per-build cost    =  Consumable $/build × Num builds\n"
            "Total consumables =  Inert gas + Per-build cost",
            S
        ),
        Spacer(1, 4*mm),
    ]))

    # --- Cat 5: Labor
    elems.append(KeepTogether([
        Paragraph("3.5  Labor", S["h3"]),
        Paragraph(
            "Labor covers two distinct activities: monitoring the machine while it runs, and "
            "physically exchanging build plates between builds. The FTE supervision fraction "
            "reflects that one operator can monitor multiple machines simultaneously.",
            S["body_justify"]
        ),
        Spacer(1, 2*mm),
        code_block(
            "Labor during build  =  (Warm-up + Print + Cool-down) × FTE supervised\n"
            "Labor at changeover =  Build exchange time × FTE for changeover\n"
            "Labor cost          =  Total labor hours × Operator hourly rate",
            S
        ),
        Spacer(1, 4*mm),
    ]))

    # --- Cat 6: Support Removal
    elems.append(KeepTogether([
        Paragraph("3.6  Support Removal (Post-Processing)", S["h3"]),
        Paragraph(
            "Support structures are temporary scaffolding printed alongside the part to anchor overhangs. "
            "They must be manually removed after printing. The time scales with the square root of the part's "
            "projected footprint area — larger parts have more interface to remove, but not linearly.",
            S["body_justify"]
        ),
        Spacer(1, 2*mm),
        code_block(
            "Removal time/part   =  Support constant × √(Part projected area)\n"
            "Total removal time  =  Time per part × Num parts\n"
            "Post-process cost   =  Total removal time × Technician hourly rate",
            S
        ),
        Spacer(1, 2*mm),
        insight_box(
            "Support removal is frequently the largest single cost driver for geometrically complex parts. "
            "Redesigning to minimise overhangs, or rotating the build orientation, can cut this cost by 30–60%.",
            content_width, S
        ),
        Spacer(1, 4*mm),
    ]))

    # --- Cat 7: Extensions
    elems.append(KeepTogether([
        Paragraph("3.7  Metal AM Extensions (Optional)", S["h3"]),
        Paragraph(
            "These post-build processes are common in metal AM production and can be toggled on or off. "
            "They are costed separately so their contribution is fully transparent.",
            S["body_justify"]
        ),
        Spacer(1, 2*mm),
    ]))

    ext_data = [
        ["Process", "Why It's Done", "How Costed"],
        ["Heat Treatment",    "Relieve residual stress; restore ductility",       "Fixed $ per build"],
        ["Part Separation",   "Cut parts off build plate (wire EDM / saw)",       "$ per part"],
        ["HIP",               "Eliminate internal porosity for safety-critical use","$ per part"],
        ["Surface Treatment", "Machining, shot peening, electropolishing",        "$ per part"],
        ["NDT Inspection",    "CT scan, X-ray, or ultrasonic testing",            "$ per part"],
    ]
    elems.append(plain_table(ext_data, [36*mm, 82*mm, content_width - 118*mm]))

    # ── SECTION 4 — Case Study ───────────────────────────────────────────────
    elems.append(PageBreak())
    elems.append(section("Case Study — Medical Stainless Steel Impeller", "4", content_width, S))

    elems.append(Paragraph(
        "A fluid-handling impeller for a medical device, manufactured in <b>316L Stainless Steel</b> via LPBF. "
        "The part contains internal flow channels that cannot be produced by conventional machining, "
        "making additive manufacturing the only viable production route.",
        S["body_justify"]
    ))
    elems.append(Spacer(1, 4*mm))

    # Part + Machine inputs side by side
    part_data = [
        ["Part Parameter", "Value"],
        ["Material",            "316L Stainless Steel"],
        ["Part mass",           "180 g"],
        ["Part volume",         "22.5 cm³"],
        ["Build height",        "90 mm"],
        ["Build footprint",     "30 cm²"],
        ["Support fraction",    "18% of part mass"],
        ["Production run",      "100 parts"],
    ]
    mach_data = [
        ["Machine Parameter", "Value"],
        ["Machine cost",         "$600,000"],
        ["Lifetime",             "10 years"],
        ["Cost of capital",      "7%"],
        ["Infrastructure",       "12% of purchase"],
        ["Maintenance",          "7% of purchase"],
        ["Build plate area",     "784 cm² (280×280mm)"],
        ["Build rate",           "15 cm³/hr (1 laser)"],
        ["Machine uptime",       "80%"],
    ]
    col = (content_width - 4*mm) / 2

    def mini_table(data, width):
        t = Table(data, colWidths=[width*0.52, width*0.48])
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), STEEL),
            ("TEXTCOLOR",     (0, 0), (-1, 0), WHITE),
            ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",      (0, 0), (-1, 0), 8),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [OFF_WHITE, LIGHT_CYAN]),
            ("FONTNAME",      (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE",      (0, 1), (-1, -1), 8),
            ("TEXTCOLOR",     (0, 1), (-1, -1), DARK_TEXT),
            ("GRID",          (0, 0), (-1, -1), 0.4, LIGHT_GRAY),
            ("TOPPADDING",    (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING",   (0, 0), (-1, -1), 5),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 5),
            ("ALIGN",         (1, 1), (-1, -1), "RIGHT"),
        ]))
        return t

    side_by_side = Table(
        [[mini_table(part_data, col), mini_table(mach_data, col)]],
        colWidths=[col, col],
        spaceBefore=0
    )
    side_by_side.setStyle(TableStyle([
        ("LEFTPADDING",  (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 0),
        ("VALIGN",       (0,0), (-1,-1), "TOP"),
        ("COLSPACING",   (0,0), (-1,-1), 4),
    ]))
    elems.append(side_by_side)

    elems.append(Spacer(1, 4*mm))

    mat_data = [
        ["Material Parameter", "Value"],
        ["Powder cost",            "$40 / kg"],
        ["Density",                "8.0 g/cm³"],
        ["Packing policy",         "2D (single layer)"],
        ["Packing efficiency",     "55%"],
        ["Powder recycling",       "80%"],
        ["Post-processing",        "Heat treatment ($300/build) · Part separation ($50/part)"],
    ]
    elems.append(mini_table(mat_data, content_width))

    # ── 4.1 Step 0
    elems.append(Spacer(1, 5*mm))
    elems.append(Paragraph("4.1  Build Planning", S["h3"]))
    elems.append(code_block(
        "Parts per build  =  floor( 784 cm² ÷ 30 cm² × 0.55 )  =  floor(14.37)  =  14 parts\n"
        "Number of builds =  ceil( 100 ÷ 14 )                  =  8 builds",
        S
    ))
    elems.append(Spacer(1, 2*mm))
    elems.append(result_box("14 parts fit per build  ·  100 parts require 8 builds", content_width, S))

    # ── 4.2 Material
    elems.append(Spacer(1, 4*mm))
    elems.append(Paragraph("4.2  Material Cost", S["h3"]))
    elems.append(code_block(
        "Part material (100 parts)  :  100 × 0.180 kg                    =   18.00 kg\n"
        "Support material (18%)     :  100 × 0.032 kg                    =    3.24 kg\n"
        "Powder deposited (8 builds):  8 × 784 cm² × 9.0 cm × 0.008     =  451.60 kg\n"
        "Unfused powder             :  451.60 − 18.00 − 3.24             =  430.36 kg\n"
        "Recycled (80%)             :                                     =  344.29 kg\n"
        "Wasted (20% of unfused)    :                                     =   86.07 kg\n"
        "Material purchased         :  18.00 + 3.24 + 86.07              =  107.31 kg\n"
        "Material cost              :  107.31 kg × $40/kg                =  $4,292",
        S
    ))
    elems.append(Spacer(1, 2*mm))
    elems.append(insight_box(
        "451 kg of powder enters the machine across 8 builds, but 80% of unfused powder is recycled. "
        "Only 107 kg needs to be purchased — a 76% reduction vs gross consumption.",
        content_width, S
    ))
    elems.append(Spacer(1, 2*mm))
    elems.append(result_box("Material cost:  $4,292  ($42.92/part)", content_width, S))

    # ── 4.3 Build Prep
    elems.append(Spacer(1, 4*mm))
    elems.append(Paragraph("4.3  Build Preparation", S["h3"]))
    elems.append(code_block(
        "Prep time  =  5 hr (first build)  +  7 × 2 hr (subsequent)  =  19 hr\n"
        "Cost       =  19 hr × $75/hr (engineer)                     =  $1,425",
        S
    ))
    elems.append(Spacer(1, 2*mm))
    elems.append(result_box("Build prep cost:  $1,425  ($14.25/part)", content_width, S))

    # ── 4.4 Machine
    elems.append(Spacer(1, 4*mm))
    elems.append(Paragraph("4.4  Machine Usage", S["h3"]))
    elems.append(code_block(
        "Total upfront cost  :  $600,000 × 1.12                                =  $672,000\n"
        "Annual depreciation :  0.07 × $672,000 ÷ (1 − 1.07^−10)             =  $95,671/yr\n"
        "Annual maintenance  :  $600,000 × 7%                                  =  $42,000/yr\n"
        "Annual machine cost :  $95,671 + $42,000                              = $137,671/yr\n"
        "Operating hours/yr  :  20 hr/day × 5 days × 52 wks × 80%            =  4,160 hr/yr\n"
        "Machine cost/hr     :  $137,671 ÷ 4,160                              =   $33.09/hr",
        S
    ))
    elems.append(Spacer(1, 2*mm))

    time_breakdown = [
        ["Phase", "Calculation", "Time"],
        ["Warm-up",         "8 builds × 2 hr",                                       "16 hr"],
        ["Laser scanning",  "100 × 22.5 cm³ × 1.18 ÷ 15 cm³/hr",                   "177 hr"],
        ["Recoating",       "177 hr × (1/0.75 − 1)",                                 "59 hr"],
        ["Cool-down",       "8 builds × 4 hr",                                        "32 hr"],
        ["Build exchange",  "8 builds × 1.5 hr",                                      "12 hr"],
        ["Total", "", "296 hr"],
    ]
    t = Table(time_breakdown, colWidths=[38*mm, 95*mm, content_width - 133*mm])
    ts = TableStyle(list(HEADER_TS._cmds))
    ts.add("BACKGROUND",  (0, len(time_breakdown)-1), (-1, len(time_breakdown)-1), NAVY)
    ts.add("TEXTCOLOR",   (0, len(time_breakdown)-1), (-1, len(time_breakdown)-1), AMBER)
    ts.add("FONTNAME",    (0, len(time_breakdown)-1), (-1, len(time_breakdown)-1), "Helvetica-Bold")
    t.setStyle(ts)
    elems.append(t)

    elems.append(Spacer(1, 2*mm))
    elems.append(result_box("Machine cost:  296 hr × $33.09/hr  =  $9,795  ($97.95/part)", content_width, S))

    # ── 4.5 Consumables
    elems.append(Spacer(1, 4*mm))
    elems.append(Paragraph("4.5  Consumables", S["h3"]))
    elems.append(code_block(
        "Build active time (warm-up + print + cool-down)  :  16 + 236 + 32  =  284 hr\n"
        "Inert gas cost    :  284 hr × $2/hr              =    $568\n"
        "Per-build supplies:  8 builds × $200/build        =  $1,600\n"
        "Total consumables :                               =  $2,168",
        S
    ))
    elems.append(Spacer(1, 2*mm))
    elems.append(result_box("Consumables cost:  $2,168  ($21.68/part)", content_width, S))

    # ── 4.6 Labor
    elems.append(Spacer(1, 4*mm))
    elems.append(Paragraph("4.6  Labor", S["h3"]))
    elems.append(code_block(
        "Monitoring (0.25 FTE):  284 hr × 0.25  =  71 hr\n"
        "Build changeover     :   12 hr × 1.0   =  12 hr\n"
        "Total labor          :                  =  83 hr\n"
        "Labor cost           :  83 hr × $50/hr  =  $4,150",
        S
    ))
    elems.append(Spacer(1, 2*mm))
    elems.append(result_box("Labor cost:  $4,150  ($41.50/part)", content_width, S))

    # ── 4.7 Support Removal
    elems.append(Spacer(1, 4*mm))
    elems.append(Paragraph("4.7  Support Removal", S["h3"]))
    elems.append(code_block(
        "Time per part  :  0.4 (constant) × √30 cm²  =  0.4 × 5.48  =  2.19 hr/part\n"
        "Total time     :  2.19 hr × 100 parts        =  219 hr\n"
        "Cost           :  219 hr × $40/hr (technician) =  $8,760",
        S
    ))
    elems.append(Spacer(1, 2*mm))
    elems.append(result_box("Post-process cost:  $8,760  ($87.60/part)", content_width, S))

    # ── 4.8 Extensions
    elems.append(Spacer(1, 4*mm))
    elems.append(Paragraph("4.8  Metal AM Extensions", S["h3"]))
    elems.append(code_block(
        "Heat treatment  :  $300/build × 8 builds  =  $2,400\n"
        "Part separation :  $50/part  × 100 parts   =  $5,000\n"
        "Extensions total:                           =  $7,400",
        S
    ))
    elems.append(Spacer(1, 2*mm))
    elems.append(result_box("Extensions cost:  $7,400  ($74.00/part)", content_width, S))

    # ── SECTION 5 — Results ──────────────────────────────────────────────────
    elems.append(PageBreak())
    elems.append(section("Cost Summary & Results", "5", content_width, S))

    summary_data = [
        ["Cost Category",        "Total Cost",  "Per Part",   "Share"],
        ["1. Material",          "$4,292",       "$42.92",    "11.3%"],
        ["2. Build Preparation", "$1,425",       "$14.25",     "3.8%"],
        ["3. Machine Usage",     "$9,795",       "$97.95",    "25.8%"],
        ["4. Consumables",       "$2,168",       "$21.68",     "5.7%"],
        ["5. Labor",             "$4,150",       "$41.50",    "10.9%"],
        ["6. Support Removal",   "$8,760",       "$87.60",    "23.1%"],
        ["7. Heat Treatment",    "$2,400",       "$24.00",     "6.3%"],
        ["8. Part Separation",   "$5,000",       "$50.00",    "13.2%"],
        ["TOTAL",               "$37,990",      "$379.90",   "100.0%"],
    ]
    t = Table(summary_data, colWidths=[75*mm, 40*mm, 40*mm, content_width - 155*mm])
    ts = TableStyle(list(HEADER_TS._cmds))
    last = len(summary_data) - 1
    ts.add("BACKGROUND",  (0, last), (-1, last), NAVY)
    ts.add("TEXTCOLOR",   (0, last), (-1, last), AMBER)
    ts.add("FONTNAME",    (0, last), (-1, last), "Helvetica-Bold")
    ts.add("FONTSIZE",    (0, last), (-1, last), 9.5)
    ts.add("TOPPADDING",  (0, last), (-1, last), 6)
    ts.add("BOTTOMPADDING",(0, last), (-1, last), 6)
    ts.add("LINEABOVE",   (0, last), (-1, last), 2, CYAN)
    t.setStyle(ts)
    elems.append(t)

    elems.append(Spacer(1, 5*mm))

    elems.append(make_kpi_row([
        ("Cost per Part",     "$379.90"),
        ("Total Run Cost",    "$37,990"),
        ("Parts per Build",   "14"),
        ("Total Builds",      "8"),
        ("Machine Rate",      "$33.09/hr"),
        ("Powder Purchased",  "107 kg"),
    ], content_width))

    # ── SECTION 6 — Key Insights ─────────────────────────────────────────────
    elems.append(Spacer(1, 6*mm))
    elems.append(section("Key Insights for Decision-Makers", "6", content_width, S))

    insights = [
        ("Support removal is the #1 labour cost ($87.60/part · 23%)",
         "This is the most frequent surprise for teams new to metal AM. Reducing overhanging features "
         "through design-for-AM, or rotating the build direction, can cut this cost by 30–60%."),
        ("Machine usage drives the second-largest share (26%)",
         "The machine costs $33/hr. Running it for 296 hours across 8 builds produces 100 parts. "
         "Fitting 20 parts per build instead of 14 would reduce machine cost per part by ~30%."),
        ("Powder cost is only 11% — feedstock is not the main cost",
         "Unlike CNC machining (where buy-to-fly ratio dominates), in AM the machine time and labour "
         "dominate. Switching to a lower-cost alloy saves far less than filling the build plate better."),
        ("Post-process extensions add 19.5% combined",
         "Heat treatment and part separation are often quoted separately by AM service providers. "
         "This model makes them explicit, attributable, and comparable across machine options."),
        ("Scale has a strong effect on cost",
         "At 100 parts: $380/part. At 50 parts: ~$490/part. At 200 parts: ~$310/part. "
         "Fixed costs (build prep, machine, heat treatment) amortise over more units at scale."),
    ]

    for title, body in insights:
        data = [[
            Paragraph(f"<b>{title}</b>",
                      ParagraphStyle("iht", fontName="Helvetica-Bold", fontSize=9,
                                     textColor=CYAN, leading=13)),
            Paragraph(body, S["body_justify"])
        ]]
        t = Table(data, colWidths=[content_width])
        t.setStyle(TableStyle([
            ("BACKGROUND",   (0,0), (-1,0), SLATE),
            ("TOPPADDING",   (0,0), (-1,-1), 5),
            ("BOTTOMPADDING",(0,0), (-1,-1), 5),
            ("LEFTPADDING",  (0,0), (-1,-1), 8),
            ("LINEBEFORE",   (0,0), (0,-1), 3, CYAN),
            ("LINEBELOW",    (0,0), (-1,-1), 0.5, LIGHT_GRAY),
        ]))
        elems.append(t)
        elems.append(Spacer(1, 2*mm))

    # ── SECTION 7 — Cost Reduction Guide ────────────────────────────────────
    elems.append(Spacer(1, 3*mm))
    elems.append(section("Cost Reduction Levers", "7", content_width, S))

    levers = [
        ["Lever", "Why It Works", "Est. Saving Potential"],
        ["Design for minimal supports",         "Cuts support removal labour — often the #1 cost",            "15–40% reduction"],
        ["Fill the build plate",                "Fewer builds → lower machine time, prep, and gas per part",   "10–30% reduction"],
        ["Increase production volume",          "Fixed costs amortise over more parts",                        "10–25% reduction"],
        ["Choose machines with larger plates",  "More parts per build without increasing print time",          "5–20% reduction"],
        ["Reduce build height",                 "Fewer powder layers → faster print + less recoating time",    "5–15% reduction"],
        ["Simplify post-processing",            "Each extension module adds 5–15% when enabled",              "Varies per step"],
        ["Negotiate powder recycling terms",    "Higher recycling fraction directly reduces material required", "3–10% reduction"],
    ]
    elems.append(plain_table(levers, [60*mm, 85*mm, content_width - 145*mm]))

    # ── Footer note
    elems.append(Spacer(1, 8*mm))
    elems.append(HRFlowable(width="100%", thickness=0.5, color=STEEL))
    elems.append(Spacer(1, 2*mm))
    elems.append(Paragraph(
        "This document was generated from the AM Cost Calculator. All calculations follow the methodology "
        "described above and can be reproduced by entering the same parameters into the tool. "
        "Figures assume standard LPBF process conditions; actual costs may vary based on supplier, "
        "location, and specific machine configuration.",
        S["caption"]
    ))

    # ── Build PDF ────────────────────────────────────────────────────────────
    doc.build(elems, onFirstPage=on_page, onLaterPages=on_page)
    print(f"PDF written → {output_path}")


if __name__ == "__main__":
    out_dir = os.path.dirname(os.path.abspath(__file__))
    build_pdf(os.path.join(out_dir, "AM_Cost_Model_Methodology.pdf"))
