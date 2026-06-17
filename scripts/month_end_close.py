"""
אוטומציה לסגירת חודש - אינסייט טק בע"מ
טוען Actuals חודשיים, מחשב שונות MoM/YoY, בונה 3 תרחישים לחודש הבא,
ומייצר דוח PDF בעברית עם סיכום מנהלים.
"""
import os
from datetime import datetime

import openpyxl
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
from bidi.algorithm import get_display

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_XLSX = os.path.join(BASE_DIR, "data", "Actuals_24M_Demo_UC2.xlsx")
OUTPUT_PDF = os.path.join(BASE_DIR, "output", "month_end_close_report.pdf")
OUTPUT_CHART = os.path.join(BASE_DIR, "output", "revenue_ebitda_chart.png")

FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

HEBREW_MONTHS = {
    "ינואר": 1, "פברואר": 2, "מרץ": 3, "אפריל": 4, "מאי": 5, "יוני": 6,
    "יולי": 7, "אוגוסט": 8, "ספטמבר": 9, "אוקטובר": 10, "נובמבר": 11, "דצמבר": 12,
}

METRIC_COLS = [
    ("revenue", "הכנסות (Revenue)"),
    ("cogs", "עלות מכר (COGS)"),
    ("gross_profit", "רווח גולמי"),
    ("gross_margin_pct", "מרווח גולמי %"),
    ("rnd", "R&D"),
    ("sm", "S&M"),
    ("ga", "G&A"),
    ("ebitda", "EBITDA"),
    ("ebitda_pct", "EBITDA %"),
    ("headcount", "עובדים (HC)"),
    ("churn_pct", "Churn Rate %"),
]


def rtl(text):
    """Reorder Hebrew/mixed text for correct visual display in reportlab."""
    return get_display(str(text))


def parse_month_label(label):
    parts = label.split()
    month = HEBREW_MONTHS[parts[0]]
    year = int(parts[1])
    return datetime(year, month, 1)


def load_actuals():
    wb = openpyxl.load_workbook(SOURCE_XLSX, data_only=True)
    ws = wb["Actuals"]
    rows = []
    for row in ws.iter_rows(min_row=4, values_only=True):
        label = row[0]
        if not label or "סה" in str(label):
            continue
        record = {"label": label, "date": parse_month_label(label)}
        for idx, (key, _) in enumerate(METRIC_COLS, start=1):
            record[key] = row[idx]
        rows.append(record)
    rows.sort(key=lambda r: r["date"])
    return rows


def variance(curr, prev):
    if prev in (None, 0):
        return None
    return (curr - prev) / abs(prev)


def build_variance_table(rows):
    """Variance of the last actual month vs. previous month (MoM) and vs. same month last year (YoY)."""
    last = rows[-1]
    prev_month = rows[-2] if len(rows) >= 2 else None
    prev_year = next((r for r in rows if r["date"].year == last["date"].year - 1
                       and r["date"].month == last["date"].month), None)

    results = []
    for key, label in METRIC_COLS:
        curr_val = last[key]
        mom = variance(curr_val, prev_month[key]) if prev_month else None
        yoy = variance(curr_val, prev_year[key]) if prev_year else None
        results.append({
            "key": key, "label": label, "value": curr_val, "mom": mom, "yoy": yoy,
        })
    return last, results


def build_scenarios(last):
    """Three forward-looking scenarios for the month following the last actual, based on revenue/EBITDA growth assumptions."""
    scenarios = {
        "baseline": {"label": "בייסליין (המשך מגמה)", "growth": 0.0},
        "optimistic": {"label": "אופטימי (+8%)", "growth": 0.08},
        "conservative": {"label": "שמרני (-5%)", "growth": -0.05},
    }
    out = {}
    for key, cfg in scenarios.items():
        g = cfg["growth"]
        revenue = last["revenue"] * (1 + g)
        cogs = last["cogs"] * (1 + g * 0.6)
        gross_profit = revenue - cogs
        opex = last["rnd"] + last["sm"] + last["ga"]
        opex_adj = opex * (1 + max(g, 0) * 0.3)
        ebitda = gross_profit - opex_adj
        out[key] = {
            "label": cfg["label"],
            "revenue": revenue,
            "cogs": cogs,
            "gross_profit": gross_profit,
            "gross_margin_pct": gross_profit / revenue if revenue else None,
            "opex": opex_adj,
            "ebitda": ebitda,
            "ebitda_pct": ebitda / revenue if revenue else None,
        }
    return out


def fmt_money(v):
    if v is None:
        return "-"
    return f"{v:,.0f}"


def fmt_pct(v, is_ratio=False):
    if v is None:
        return "-"
    if is_ratio:
        return f"{v*100:,.1f}%"
    return f"{v*100:+.1f}%"


def make_chart(rows):
    font_prop = font_manager.FontProperties(fname=FONT_PATH)
    dates = [r["date"] for r in rows]
    revenue = [r["revenue"] for r in rows]
    ebitda = [r["ebitda"] for r in rows]

    fig, ax1 = plt.subplots(figsize=(7.5, 3.2))
    ax1.plot(dates, revenue, color="#1f4e79", linewidth=2, label="Revenue")
    ax1.plot(dates, ebitda, color="#c0504d", linewidth=2, label="EBITDA")
    ax1.set_title(get_display("הכנסות ו-EBITDA - 24 חודשים אחרונים"), fontproperties=font_prop, fontsize=12)
    ax1.legend(loc="upper left", fontsize=9)
    ax1.grid(alpha=0.3)
    ax1.tick_params(axis="x", rotation=45, labelsize=8)
    ax1.tick_params(axis="y", labelsize=8)
    fig.tight_layout()
    fig.savefig(OUTPUT_CHART, dpi=150)
    plt.close(fig)


def draw_header(c, width, height, y, text, size=16, bold=True):
    font = "Heb-Bold" if bold else "Heb"
    c.setFont(font, size)
    c.drawRightString(width - 20 * mm, y, rtl(text))
    return y - size * 1.4


def draw_table(c, x, y, headers, data, col_widths, row_height=6.5 * mm, header_bg=colors.HexColor("#1f4e79")):
    table_data = [[rtl(h) for h in headers]] + [[rtl(cell) for cell in row] for row in data]
    t = Table(table_data, colWidths=col_widths, rowHeights=row_height)
    style = TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Heb"),
        ("FONTNAME", (0, 0), (-1, 0), "Heb-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f2f2")]),
    ])
    t.setStyle(style)
    tw, th = t.wrapOn(c, sum(col_widths), row_height * len(table_data))
    t.drawOn(c, x, y - th)
    return y - th


def generate_pdf(rows, last, variances, scenarios):
    pdfmetrics.registerFont(TTFont("Heb", FONT_PATH))
    pdfmetrics.registerFont(TTFont("Heb-Bold", FONT_BOLD_PATH))

    width, height = A4
    c = canvas.Canvas(OUTPUT_PDF, pagesize=A4)

    # --- Page 1: Title + Executive Summary ---
    y = height - 25 * mm
    c.setFillColor(colors.HexColor("#1f4e79"))
    c.rect(0, height - 30 * mm, width, 30 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Heb-Bold", 20)
    c.drawRightString(width - 20 * mm, height - 14 * mm, rtl("דוח סגירת חודש - אינסייט טק בע\"מ"))
    c.setFont("Heb", 11)
    c.drawRightString(width - 20 * mm, height - 22 * mm, rtl(f"חודש אקטואל: {last['label']}  |  הופק בתאריך: {datetime.now().strftime('%d/%m/%Y')}"))
    c.setFillColor(colors.black)

    y = height - 40 * mm
    y = draw_header(c, width, height, y, "סיכום מנהלים", size=14)
    y -= 2 * mm

    rev = last["revenue"]
    ebitda = last["ebitda"]
    rev_yoy = next(v["yoy"] for v in variances if v["key"] == "revenue")
    rev_mom = next(v["mom"] for v in variances if v["key"] == "revenue")
    ebitda_yoy = next(v["yoy"] for v in variances if v["key"] == "ebitda")
    ebitda_mom = next(v["mom"] for v in variances if v["key"] == "ebitda")
    margin = last["gross_margin_pct"]
    churn = last["churn_pct"]
    hc = last["headcount"]

    summary_lines = [
        f"בחודש {last['label']} הסתכמו ההכנסות ב-{fmt_money(rev)} ש\"ח, עלייה של {fmt_pct(rev_yoy)} לעומת אותו חודש בשנה שעברה (YoY) ו-{fmt_pct(rev_mom)} לעומת החודש הקודם (MoM).",
        f"ה-EBITDA עמד על {fmt_money(ebitda)} ש\"ח ({fmt_pct(last['ebitda_pct'], is_ratio=True)} משולי EBITDA), שינוי של {fmt_pct(ebitda_yoy)} YoY ו-{fmt_pct(ebitda_mom)} MoM.",
        f"המרווח הגולמי עומד על {fmt_pct(margin, is_ratio=True)}, ומשקף המשך מגמת השיפור התפעולי של החברה.",
        f"שיעור Churn חודשי עמד על {fmt_pct(churn, is_ratio=True)}, ומצבת העובדים מסתכמת ב-{hc:.0f} עובדים.",
        "להלן שלושה תרחישי תחזית לחודש הקרוב: בייסליין (המשך מגמה), אופטימי (+8% צמיחה בהכנסות) ושמרני (-5%), לצורך בקרת תכנון וניהול סיכונים.",
    ]
    c.setFont("Heb", 10.5)
    for line in summary_lines:
        # wrap manually at ~95 chars
        words = line.split(" ")
        cur = ""
        wrapped = []
        for w in words:
            trial = (cur + " " + w).strip()
            if c.stringWidth(rtl(trial), "Heb", 10.5) > (width - 40 * mm):
                wrapped.append(cur)
                cur = w
            else:
                cur = trial
        if cur:
            wrapped.append(cur)
        for wline in wrapped:
            c.drawRightString(width - 20 * mm, y, rtl(wline))
            y -= 5.5 * mm
        y -= 2 * mm

    y -= 3 * mm
    if os.path.exists(OUTPUT_CHART):
        img_w = width - 40 * mm
        img_h = img_w * (3.2 / 7.5)
        c.drawImage(OUTPUT_CHART, 20 * mm, y - img_h, width=img_w, height=img_h, preserveAspectRatio=True)
        y -= img_h + 6 * mm

    c.showPage()

    # --- Page 2: Variance table ---
    y = height - 20 * mm
    y = draw_header(c, width, height, y, f"שונות MoM ו-YoY - {last['label']}", size=14)
    y -= 4 * mm

    headers = ["מדד", "ערך נוכחי", "שינוי MoM", "שינוי YoY"]
    pct_keys = {"gross_margin_pct", "ebitda_pct", "churn_pct"}
    table_rows = []
    for v in variances:
        is_pct = v["key"] in pct_keys
        if v["key"] == "headcount":
            val_str = f"{v['value']:.0f}"
        elif is_pct:
            val_str = fmt_pct(v["value"], is_ratio=True)
        else:
            val_str = fmt_money(v["value"])
        table_rows.append([v["label"], val_str, fmt_pct(v["mom"]), fmt_pct(v["yoy"])])

    col_widths = [55 * mm, 40 * mm, 35 * mm, 35 * mm]
    y = draw_table(c, 20 * mm, y, headers, table_rows, col_widths)

    c.showPage()

    # --- Page 3: Scenarios ---
    y = height - 20 * mm
    y = draw_header(c, width, height, y, "תרחישי תחזית לחודש הקרוב", size=14)
    y -= 4 * mm

    headers2 = ["תרחיש", "הכנסות", "רווח גולמי", "מרווח גולמי %", "EBITDA", "EBITDA %"]
    table_rows2 = []
    for key in ("baseline", "optimistic", "conservative"):
        s = scenarios[key]
        table_rows2.append([
            s["label"], fmt_money(s["revenue"]), fmt_money(s["gross_profit"]),
            fmt_pct(s["gross_margin_pct"], is_ratio=True), fmt_money(s["ebitda"]),
            fmt_pct(s["ebitda_pct"], is_ratio=True),
        ])
    col_widths2 = [40 * mm, 30 * mm, 30 * mm, 30 * mm, 25 * mm, 25 * mm]
    y = draw_table(c, 20 * mm, y, headers2, table_rows2, col_widths2)

    y -= 8 * mm
    c.setFont("Heb", 10)
    note = "הערות מתודולוגיה: הבייסליין מניח המשך מגמה ללא שינוי בהכנסות; התרחיש האופטימי מניח צמיחת הכנסות של 8% עם השפעה חלקית על עלות המכר וההוצאות התפעוליות; התרחיש השמרני מניח ירידה של 5% בהכנסות."
    words = note.split(" ")
    cur = ""
    wrapped = []
    for w in words:
        trial = (cur + " " + w).strip()
        if c.stringWidth(rtl(trial), "Heb", 10) > (width - 40 * mm):
            wrapped.append(cur)
            cur = w
        else:
            cur = trial
    if cur:
        wrapped.append(cur)
    for wline in wrapped:
        c.drawRightString(width - 20 * mm, y, rtl(wline))
        y -= 5 * mm

    c.save()


def main():
    rows = load_actuals()
    last, variances = build_variance_table(rows)
    scenarios = build_scenarios(last)
    make_chart(rows)
    generate_pdf(rows, last, variances, scenarios)

    print(f"חודש אקטואל אחרון: {last['label']}")
    print(f"הכנסות: {fmt_money(last['revenue'])} ש\"ח | EBITDA: {fmt_money(last['ebitda'])} ש\"ח")
    print("\nשונות MoM/YoY:")
    for v in variances:
        print(f"  {v['label']:<25} ערך={fmt_money(v['value']) if v['key'] not in ('gross_margin_pct','ebitda_pct','churn_pct') else fmt_pct(v['value'], True):>12}  MoM={fmt_pct(v['mom']):>8}  YoY={fmt_pct(v['yoy']):>8}")
    print("\nתרחישים לחודש הקרוב:")
    for key in ("baseline", "optimistic", "conservative"):
        s = scenarios[key]
        print(f"  {s['label']:<25} הכנסות={fmt_money(s['revenue']):>10}  EBITDA={fmt_money(s['ebitda']):>10}")
    print(f"\nדוח PDF נוצר: {OUTPUT_PDF}")


if __name__ == "__main__":
    main()
