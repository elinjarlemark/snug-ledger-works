#!/usr/bin/env python3
from __future__ import annotations

import ast
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional


def extract_key(node: ast.AST) -> Optional[str]:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    if isinstance(node, ast.Index):
        return extract_key(node.value)
    return None


def extract_data_key(target: ast.AST) -> Optional[str]:
    if not isinstance(target, ast.Subscript):
        return None
    if isinstance(target.value, ast.Name) and target.value.id == 'data':
        return extract_key(target.slice)
    return None


def extract_row_key(target: ast.AST) -> Optional[str]:
    if not isinstance(target, ast.Subscript):
        return None
    if isinstance(target.value, ast.Name) and target.value.id == 'row':
        return extract_key(target.slice)
    return None


def extract_member_key(target: ast.AST) -> Optional[str]:
    if not isinstance(target, ast.Subscript):
        return None
    inner = target.value
    if not isinstance(inner, ast.Subscript):
        return None
    if not isinstance(inner.value, ast.Name) or inner.value.id != 'members':
        return None
    return extract_key(target.slice)


def format_fstring(node: ast.AST) -> Optional[str]:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    if not isinstance(node, ast.JoinedStr):
        return None
    parts: List[str] = []
    for value in node.values:
        if isinstance(value, ast.Constant):
            parts.append(str(value.value))
            continue
        if isinstance(value, ast.FormattedValue):
            expr = value.value
            if isinstance(expr, ast.Name):
                parts.append('{' + expr.id + '}')
                continue
            if isinstance(expr, ast.BinOp) and isinstance(expr.op, ast.Add):
                if isinstance(expr.left, ast.Name) and expr.left.id == 'idx' and isinstance(expr.right, ast.Constant) and expr.right.value == 1:
                    parts.append('{index}')
                    continue
            parts.append('{value}')
            continue
    return ''.join(parts)


def extract_call(stmt: ast.stmt) -> Optional[ast.Call]:
    node: Optional[ast.AST] = None
    if isinstance(stmt, ast.Assign):
        node = stmt.value
    elif isinstance(stmt, ast.Expr):
        node = stmt.value
    else:
        return None
    if isinstance(node, ast.Call):
        return node
    return None


def widget_for(label: str, kind: str) -> str:
    low = label.lower()
    if kind == 'bool':
        return 'switch'
    if kind == 'select':
        return 'select'
    if kind in {'int', 'number'}:
        return 'input'
    if 'yyyy-mm-dd' in low or 'datum' in low:
        return 'input'
    if any(word in low for word in ['verksamhetsbeskrivning', 'väsentliga händelser', 'kommentar', 'text för upplysning']):
        return 'textarea'
    return 'input'


def make_field(field_id: str, label: str, kind: str, section: str, *, options: Optional[List[Dict[str, str]]] = None, depends_on: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {
        'id': field_id,
        'label': label,
        'kind': kind,
        'section': section,
        'widget': widget_for(label, kind),
        **({'options': options} if options else {}),
        **({'dependsOn': depends_on} if depends_on else {}),
    }


def extract_schema(target_path: Path) -> Dict[str, Any]:
    source = target_path.read_text(encoding='utf-8')
    tree = ast.parse(source)
    collect_fn = None
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name == 'collect_manual_data':
            collect_fn = node
            break
    if collect_fn is None:
        raise SystemExit('Kunde inte hitta collect_manual_data i v7-scriptet.')

    fields: List[Dict[str, Any]] = []
    repeaters: List[Dict[str, Any]] = []
    section = 'general'
    own_shares_dep = {'field': 'has_own_shares', 'value': True}

    for stmt in collect_fn.body:
        if isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Call):
            call = stmt.value
            if isinstance(call.func, ast.Name) and call.func.id == 'print' and call.args:
                text = format_fstring(call.args[0]) or ''
                if 'K2-kontroll' in text:
                    section = 'k2'
                continue

        if isinstance(stmt, ast.Assign) and stmt.targets:
            data_key = extract_data_key(stmt.targets[0])
            if data_key:
                call = stmt.value if isinstance(stmt.value, ast.Call) else None
                if call and isinstance(call.func, ast.Name):
                    func_name = call.func.id
                    label = format_fstring(call.args[0]) if call.args else None
                    if label:
                        if func_name == 'prompt_text':
                            fields.append(make_field(data_key, label, 'text', section))
                        elif func_name == 'prompt_decimal_text':
                            fields.append(make_field(data_key, label, 'text', section))
                        elif func_name == 'prompt_int':
                            fields.append(make_field(data_key, label, 'int', section))
                        elif func_name == 'prompt_bool':
                            fields.append(make_field(data_key, label, 'bool', section))
                continue

        if isinstance(stmt, ast.If):
            for inner in stmt.body:
                if isinstance(inner, ast.Assign) and inner.targets:
                    data_key = extract_data_key(inner.targets[0])
                    if data_key == 'own_shares_text' and isinstance(inner.value, ast.Call):
                        label = format_fstring(inner.value.args[0]) if inner.value.args else None
                        if label:
                            fields.append(make_field(data_key, label, 'text', section, depends_on=own_shares_dep))
            continue

        if isinstance(stmt, ast.While):
            labels = []
            for inner in ast.walk(stmt):
                if isinstance(inner, ast.Call) and isinstance(inner.func, ast.Name) and inner.func.id == 'prompt_text' and inner.args:
                    labels.append(format_fstring(inner.args[0]))
            labels = [label for label in labels if label]
            if not labels:
                continue
            label = labels[0]
            if 'Inlämningssätt' in label:
                fields.append(make_field('report_mode', label, 'select', section, options=[
                    {'value': 'paper', 'label': 'Paper'},
                    {'value': 'digital', 'label': 'Digital'},
                ]))
            elif 'Avrundningsläge' in label:
                fields.append(make_field('rounding_mode', label, 'select', section, options=[
                    {'value': 'truncate', 'label': 'truncate'},
                    {'value': 'half_up', 'label': 'half_up'},
                ]))
            elif 'Skattesats för soliditet' in label:
                fields.append(make_field('tax_rate_soliditet', label, 'number', section))
            continue

    history_repeater = {
        'id': 'flerarsoversikt',
        'label': 'Flerårsöversikt tidigare år',
        'kind': 'year_history',
        'section': 'history',
        'yearsBack': [2, 3],
        'fields': [],
    }
    signatory_repeater = {
        'id': 'board_members',
        'label': 'Underskrifter',
        'kind': 'signatories',
        'section': 'signatures',
        'countField': make_field('board_member_count', 'Antal underskrifter i dokumentet', 'int', 'signatures'),
        'fields': [],
    }

    for inner in ast.walk(collect_fn):
        if isinstance(inner, ast.Assign) and inner.targets:
            row_key = extract_row_key(inner.targets[0])
            member_key = extract_member_key(inner.targets[0])
            data_key = extract_data_key(inner.targets[0])
            call = inner.value if isinstance(inner.value, ast.Call) else None
            if row_key and call and isinstance(call.func, ast.Name):
                label = format_fstring(call.args[0]) if call.args else None
                if label:
                    kind = 'int' if call.func.id == 'prompt_int' else 'text'
                    history_repeater['fields'].append(make_field(row_key, label, kind, 'history'))
            elif member_key and call and isinstance(call.func, ast.Name):
                label = format_fstring(call.args[0]) if call.args else None
                if label:
                    signatory_repeater['fields'].append(make_field(member_key, label, 'text', 'signatures'))
            elif data_key == 'member_count' and call and isinstance(call.func, ast.Name) and call.func.id == 'prompt_int':
                signatory_repeater['countField'] = make_field('board_member_count', format_fstring(call.args[0]) or 'Antal underskrifter i dokumentet', 'int', 'signatures')

    if history_repeater['fields']:
        repeaters.append(history_repeater)
    if signatory_repeater['fields']:
        repeaters.append(signatory_repeater)

    # Remove fields that will be represented by repeaters or specialized controls
    deduped: List[Dict[str, Any]] = []
    seen = set()
    for field in fields:
        key = (field['id'], field['label'])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(field)

    # Normalize date widgets for signatories and generic date fields
    for field in deduped:
        if 'YYYY-MM-DD' in field['label'] or field['id'] in {'adoption_date', 'document_date', 'submission_date'}:
            field['widget'] = 'date'

    for repeater in repeaters:
        unique_fields = []
        repeater_seen = set()
        for field in repeater.get('fields', []):
            key = (field['id'], field['label'])
            if key in repeater_seen:
                continue
            repeater_seen.add(key)
            if 'YYYY-MM-DD' in field['label']:
                field['widget'] = 'date'
            unique_fields.append(field)
        repeater['fields'] = unique_fields
        if repeater.get('countField'):
            repeater['countField']['widget'] = 'input'

    return {
        'title': 'Årsredovisning V7 frågor',
        'source': str(target_path.name),
        'fields': deduped,
        'repeaters': repeaters,
        'sectionOrder': ['general', 'k2', 'history', 'signatures'],
        'sectionLabels': {
            'general': 'Grunduppgifter',
            'k2': 'K2-kontroll',
            'history': 'Flerårsöversikt',
            'signatures': 'Underskrifter',
        },
    }


def main() -> None:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent / 'generate_arsredovisning_from_sie_v7.py'
    schema = extract_schema(target)
    sys.stdout.write(json.dumps(schema, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
