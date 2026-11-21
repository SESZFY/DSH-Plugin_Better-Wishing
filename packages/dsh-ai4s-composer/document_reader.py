import io
import json
import re
import sys
import zipfile
from itertools import islice
from pathlib import Path


def bounded_window(entries, start, limit, header=(), entry_chars=5500):
    lines = list(header)
    remaining = 18000 - sum(len(line) + 1 for line in lines)
    for number, text in enumerate(islice(entries, limit + 1), start):
        if len(text) > entry_chars:
            text = text[:entry_chars] + " … [此项过长，已截断]"
        if number == start + limit or len(text) + 1 > remaining:
            lines.append(f"[后续内容请用 start={number} 继续读取。]")
            break
        lines.append(text)
        remaining -= len(text) + 1
    if len(lines) == len(header):
        lines.append("[指定起始位置没有可读内容。]")
    return "\n".join(lines)


def pdf_text(data, options):
    import pymupdf

    start = options.get("start", 1)
    limit = min(options.get("limit", 3), 8)
    tessdata = Path(".")
    with pymupdf.open(stream=data, filetype="pdf") as document:
        if document.needs_pass:
            raise ValueError("PDF 需要密码。请先提供解锁后的文件。")

        def pages():
            for index in range(start - 1, min(start + limit, len(document))):
                if index == start + limit - 1:
                    yield ""  # Look ahead for the next page without decoding or running OCR.
                    return
                page = document[index]
                text = page.get_text(sort=True).strip()
                label = f"第 {index + 1} 页"
                if not text and page.get_images():
                    if not all((tessdata / f"{language}.traineddata").is_file() for language in ("chi_sim", "eng")):
                        yield f"{label}\n[扫描页无法读取。OCR 语言数据缺失。]"
                        continue
                    dpi = max(36, min(180, int(72 * 3200 / max(page.rect.width, page.rect.height))))
                    try:
                        textpage = page.get_textpage_ocr(language="chi_sim+eng", dpi=dpi, full=True, tessdata=str(tessdata))
                        text = page.get_text(textpage=textpage, sort=True).strip()
                    except pymupdf.mupdf.FzErrorBase:
                        yield f"{label}\n[此扫描页的 OCR 未能完成。]"
                        continue
                    label += "（OCR）"
                yield f"{label}\n{text or '[本页没有可提取的文字。]'}"

        return bounded_window(pages(), start, limit, [f"PDF 共 {len(document)} 页"], entry_chars=14000)


def check_office_archive(data):
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        entries = archive.infolist()
        if len(entries) > 20000 or sum(entry.file_size for entry in entries) > 256 * 1024 * 1024:
            raise ValueError("文档解压后的结构过大。请拆分文件后读取。")


def word_text(data, options):
    from docx import Document
    from docx.text.paragraph import Paragraph

    check_office_archive(data)
    document = Document(io.BytesIO(data))

    def blocks():
        number = 0
        for block in document.iter_inner_content():
            if isinstance(block, Paragraph):
                if block.text.strip():
                    number += 1
                    yield f"[{number}] {block.text}"
            else:
                for row in block.rows:
                    number += 1
                    cells = " | ".join(cell.text.replace("\n", " / ") for cell in row.cells)
                    yield f"[{number}] 表格行 {cells}"

    start = options.get("start", 1)
    return bounded_window(islice(blocks(), start - 1, None), start, options.get("limit", 40))


def excel_text(data, options):
    from openpyxl import load_workbook
    from openpyxl.utils import get_column_letter

    def read_rows(names, rows_for_sheet, note):
        sheet = options.get("sheet", names[0])
        header = ["工作表列表（sheet 参数可切换） " + json.dumps(names, ensure_ascii=False)[:2500]]
        if sheet not in names:
            return "\n".join([*header, f"[没有找到工作表 {sheet!r}。]"])
        start = options.get("start", 1)
        limit = options.get("limit", 25)
        column = options.get("column_start", 1)
        last_column = min(16384, column + options.get("column_limit", 16) - 1)
        header.append(f"读取 {sheet} 的 {get_column_letter(column)}–{get_column_letter(last_column)} 列")
        if note:
            header.append(note)

        def formatted_rows():
            for row_number, values in enumerate(rows_for_sheet(sheet, start, start + limit, column, last_column), start):
                cells = []
                for index, value in enumerate(values, column):
                    if value is None or value == "":
                        continue
                    label = f"{get_column_letter(index)}{row_number}"
                    string = str(value)
                    if len(string) > 500:
                        string = string[:500] + " … [截断]"
                    cells.append(f"{label}={json.dumps(string, ensure_ascii=False)}")
                yield " | ".join(cells) or f"第 {row_number} 行 [空]"

        return bounded_window(formatted_rows(), start, limit, header)

    if options["format"] == "xlsx":
        check_office_archive(data)
        formulas = options.get("formulas", False)
        workbook = load_workbook(io.BytesIO(data), read_only=True, data_only=not formulas, keep_links=False)
        try:
            def xlsx_rows(sheet, start, end, column, last_column):
                worksheet = workbook[sheet]
                if worksheet.max_row is not None:
                    end = min(end, worksheet.max_row)
                if start <= end:
                    yield from worksheet.iter_rows(min_row=start, max_row=end, min_col=column, max_col=last_column, values_only=True)

            note = "当前显示公式" if formulas else "公式单元格显示保存时的计算值。用 formulas=true 可查看公式。"
            return read_rows([sheet.title for sheet in workbook.worksheets], xlsx_rows, note)
        finally:
            workbook.close()

    import xlrd

    workbook = xlrd.open_workbook(file_contents=data, on_demand=True)
    try:
        def xls_rows(sheet, start, end, column, last_column):
            worksheet = workbook.sheet_by_name(sheet)
            for row in range(start - 1, min(end, worksheet.nrows)):
                cells = worksheet.row_slice(row, column - 1, last_column)
                yield [xlrd.xldate_as_datetime(cell.value, workbook.datemode).isoformat(sep=" ")
                       if cell.ctype == xlrd.XL_CELL_DATE else cell.value for cell in cells]

        return read_rows(workbook.sheet_names(), xls_rows, "")
    finally:
        workbook.release_resources()


def xsl_source(data, options):
    if data.startswith((b"\xff\xfe", b"\xfe\xff")):
        encoding = "utf-16"
    else:
        declaration = re.match(br"<\?xml\s+[^>]*encoding=['\"]([A-Za-z0-9_.-]+)['\"]", data[:256])
        encoding = declaration[1].decode("ascii") if declaration else "utf-8-sig"
    start = options.get("start", 1)
    with io.TextIOWrapper(io.BytesIO(data), encoding=encoding) as stream:
        lines = islice(stream, start - 1, None)
        numbered = (f"{index} | {line.rstrip()}" for index, line in enumerate(lines, start))
        return bounded_window(numbered, start, options.get("limit", 40))


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    options = json.loads(sys.argv[1])
    data = sys.stdin.buffer.read()
    reader = {"pdf": pdf_text, "docx": word_text, "xlsx": excel_text, "xls": excel_text, "xsl": xsl_source}[options["format"]]
    try:
        print(reader(data, options))
    except Exception as error:
        print(f"无法解析此文档（{type(error).__name__}）。{str(error)[:700]}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
