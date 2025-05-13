"""
Google Sheets API integration.
Read/write/aggregate data from Google Spreadsheets.
"""

from __future__ import annotations
import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
from app.config import GOOGLE_SHEETS_CREDENTIALS_PATH

_service = None


def get_sheets_service():
    global _service
    if _service is not None:
        return _service

    creds_path = GOOGLE_SHEETS_CREDENTIALS_PATH
    if not creds_path or not os.path.exists(creds_path):
        raise RuntimeError("Google Sheets credentials not configured")

    creds = service_account.Credentials.from_service_account_file(
        creds_path,
        scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"],
    )
    _service = build("sheets", "v4", credentials=creds)
    return _service


def read_range(spreadsheet_id: str, range_name: str) -> list[list[str]]:
    """Read a range from a spreadsheet. Returns 2D array of values."""
    service = get_sheets_service()
    result = service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=range_name,
    ).execute()
    return result.get("values", [])


def read_sheet(spreadsheet_id: str, sheet_name: str) -> list[list[str]]:
    """Read an entire sheet."""
    return read_range(spreadsheet_id, sheet_name)


def aggregate_column(
    spreadsheet_id: str,
    sheet_name: str,
    target_column: str,
    aggregation: str = "sum",
    date_column: str | None = None,
    date_range: str | None = None,
) -> dict:
    """
    Aggregate a column from a spreadsheet.
    target_column: Column letter (A, B, C...)
    aggregation: "sum" | "count" | "average" | "min" | "max"
    """
    rows = read_sheet(spreadsheet_id, sheet_name)
    if not rows:
        return {"value": 0, "rowCount": 0}

    # Find column index from letter
    col_idx = ord(target_column.upper()) - ord("A")

    values = []
    for row in rows[1:]:  # Skip header
        if col_idx < len(row):
            try:
                val = float(row[col_idx].replace(",", "").replace("¥", "").replace("$", ""))
                values.append(val)
            except (ValueError, AttributeError):
                continue

    if not values:
        return {"value": 0, "rowCount": 0}

    result_value = 0.0
    if aggregation == "sum":
        result_value = sum(values)
    elif aggregation == "count":
        result_value = len(values)
    elif aggregation == "average":
        result_value = sum(values) / len(values)
    elif aggregation == "min":
        result_value = min(values)
    elif aggregation == "max":
        result_value = max(values)

    return {
        "value": result_value,
        "rowCount": len(values),
        "aggregation": aggregation,
    }


def get_sheet_metadata(spreadsheet_id: str) -> dict:
    """Get spreadsheet metadata (title, sheet names)."""
    service = get_sheets_service()
    result = service.spreadsheets().get(
        spreadsheetId=spreadsheet_id,
        fields="properties.title,sheets.properties.title",
    ).execute()
    return {
        "title": result.get("properties", {}).get("title", ""),
        "sheets": [
            s.get("properties", {}).get("title", "")
            for s in result.get("sheets", [])
        ],
    }
