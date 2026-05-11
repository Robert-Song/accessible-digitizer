import json
import sys

try:
    import pdfplumber
except ModuleNotFoundError as exc:
    raise SystemExit("ModuleNotFoundError: No module named 'pdfplumber'") from exc


TEXT_REPLACEMENTS = {
    "\u2022": "-",
    "\u210b": "\\mathcal{H}",
    "\u2264": "\\le",
    "\u2018": "'",
    "\u2019": "'",
    "\u201c": '"',
    "\u201d": '"',
    "\u2013": "-",
    "\u2014": "-",
    "\u2212": "-",
    "\u00a0": " ",
}


def make_llm_safe_text(text):
    safe = []
    for char in text:
        replacement = TEXT_REPLACEMENTS.get(char)
        if replacement is not None:
            safe.append(replacement)
            continue

        if char in ("\n", "\t") or ord(char) >= 32:
            safe.append(char)

    return "".join(safe)


def main(pdf_path):
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for index, page in enumerate(pdf.pages, start=1):
            try:
                text = page.extract_text() or page.extract_text(layout=True) or ""
            except Exception:
                text = ""

            pages.append({
                "pageNumber": index,
                "text": make_llm_safe_text(text).strip(),
            })

    output = json.dumps({"pages": pages})
    sys.stdout.buffer.write(output.encode("utf-8"))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: extract_pdf_text.py <pdf-path>")
    main(sys.argv[1])
