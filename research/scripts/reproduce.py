#!/usr/bin/env python3
"""Reproduce the supplied archive and independently compare JS geometry to Python."""
from pathlib import Path
import hashlib
import importlib.util
import json
import subprocess
ROOT=Path(__file__).resolve().parents[2]
ARCHIVE=ROOT/'research/archive/2026-09-23'
for line in (ROOT/'research/archive/SHA256SUMS').read_text().splitlines():
    digest,name=line.split('  ',1)
    if hashlib.sha256((ROOT/'research/archive'/name).read_bytes()).hexdigest()!=digest:
        raise AssertionError(f'Archive changed: {name}')
spec=importlib.util.spec_from_file_location('archive_lab',ARCHIVE/'crosshair_lab.py')
lab=importlib.util.module_from_spec(spec);spec.loader.exec_module(lab)
checks=lab.self_test()
assert lab.audit()==json.loads((ARCHIVE/'results.json').read_text())
subprocess.run(['node','research/scripts/audit.mjs'],cwd=ROOT,check=True,capture_output=True)
js=json.loads((ROOT/'research/generated/audit.json').read_text())
py=lab.audit()
assert js['counts']==py['comparison_counts']
for row,other in zip(js['rows'],py['cases'],strict=True):
    assert row['player']==other['player'] and row['height']==other['height']
    for key,archive_key in [('length','arm_length_px'),('width','thickness_px'),('gapOffset','gap_offset_px'),('near','near_inner_offset_px'),('far','far_inner_offset_px')]:
        assert row['old'][key]==other[archive_key],(row,key)
assert js['cases']==len(py['cases'])==56
print(json.dumps({'archive_checks_passed':checks,'archive_unchanged':True,'archive_reproduced':True,'js_python_cases_equal':56,'scope':'Source-model tests, no CS2 client execution.'},indent=2))
