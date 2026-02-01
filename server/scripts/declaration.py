"""Generate a basic PDF for declaration output."""

from pathlib import Path


def write_simple_pdf(output_path: Path, text: str) -> None:
    content_stream = f"BT /F1 24 Tf 72 720 Td ({text}) Tj ET"
    objects = [
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
        "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
        f"5 0 obj\n<< /Length {len(content_stream)} >>\nstream\n{content_stream}\nendstream\nendobj\n",
    ]

    xref_positions = []
    pdf_body = "%PDF-1.4\n"
    for obj in objects:
        xref_positions.append(len(pdf_body))
        pdf_body += obj

    xref_start = len(pdf_body)
    pdf_body += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n"
    for pos in xref_positions:
        pdf_body += f"{pos:010d} 00000 n \n"
    pdf_body += (
        "trailer\n"
        f"<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        "startxref\n"
        f"{xref_start}\n"
        "%%EOF\n"
    )

    output_path.write_text(pdf_body, encoding="latin-1")


def main() -> int:
    output_path = Path(__file__).with_name("declaration.pdf")
    write_simple_pdf(output_path, "created declaration")
    print(f"Declaration PDF created at {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
