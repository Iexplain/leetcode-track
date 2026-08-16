#!/usr/bin/env python3
"""Verify newly-generated problem JSONs:
- Load each JSON
- For each example: feed its `input` to each of the 3 solutions, capture stdout, compare to expected `output`
- Report PASS/FAIL per (problem, level, example)
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

# Force UTF-8 stdout for Windows console (cp936/GBK doesn't render emoji)
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
_PREEXISTING = {1, 3, 11, 13, 15, 20, 27, 53, 70, 88, 206, 322, 704}
NEW_IDS = sorted(
    int(p.stem)
    for p in (ROOT / "data" / "problems").glob("*.json")
    if p.stem.isdigit() and int(p.stem) not in _PREEXISTING
)


def normalize_output(text: str) -> str:
    """Flatten newlines to spaces + strip, for robust compare."""
    return ' '.join(text.split())


def run_solution(code: str, stdin_input: str) -> tuple[bool, str]:
    """Run code with given stdin; return (ok, output_or_error)."""
    try:
        result = subprocess.run(
            ["python", "-c", code],
            input=stdin_input,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except subprocess.TimeoutExpired:
        return False, "TIMEOUT"
    if result.returncode != 0:
        return False, f"EXIT={result.returncode} STDERR={result.stderr[:300]}"
    return True, result.stdout


def verify_one(pid: int) -> dict:
    path = ROOT / "data" / "problems" / f"{pid}.json"
    with open(path, encoding="utf-8") as f:
        prob = json.load(f)
    title = prob["title"]
    results = []
    for ex_idx, ex in enumerate(prob["examples"]):
        for sol in prob["solutions"]:
            level = sol["level"]
            ok, out = run_solution(sol["code"], ex["input"])
            expected = ex["output"]
            match = normalize_output(out) == normalize_output(expected)
            results.append({
                "level": level,
                "ex": ex_idx,
                "ok": ok and match,
                "expected": expected,
                "got": normalize_output(out)[:200],
                "err": "" if match else (out if ok else out),
            })
    return {"id": pid, "title": title, "results": results}


def main():
    overall_ok = True
    for pid in NEW_IDS:
        r = verify_one(pid)
        print(f"\n=== Problem {r['id']} - {r['title']} ===")
        for res in r["results"]:
            mark = "✅" if res["ok"] else "❌"
            print(f"  {mark} level={res['level']:<4} ex={res['ex']}  expected={res['expected']!r:<30}  got={res['got']!r}")
            if not res["ok"]:
                overall_ok = False
                if res["err"]:
                    print(f"     ↳ err: {res['err'][:200]}")
    print("\n" + ("=" * 40))
    print("ALL PASS ✅" if overall_ok else "FAILURES PRESENT ❌")
    sys.exit(0 if overall_ok else 1)


if __name__ == "__main__":
    main()
