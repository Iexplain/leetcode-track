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
NEW_IDS = [
    # Round 1
    9, 14, 21, 26, 35, 58, 66, 67, 69, 136,
    # Round 2 batch 1 (arrays/strings/bits)
    28, 118, 121, 125, 169, 190, 191, 202, 205, 219,
    228, 242, 283, 290, 383, 392,
    # Round 2 batch 2 (trees + lists)
    94, 100, 101, 104, 108, 112, 222, 226, 530, 543, 637,
    141, 160, 234,
    # Round 3 medium batch
    5, 46, 78, 200, 208, 215, 300, 347, 394, 739,
    # Round 4 medium batch
    2, 4, 22, 31, 42, 72, 79, 84, 128, 146,
    # Round 5 medium batch
    6, 10, 17, 19, 23, 24, 25, 29, 32,
    # Round 6 medium batch
    33, 34, 39, 40, 47, 48, 49, 50, 54, 75,
    # Round 7 medium batch
    56, 57, 62, 63, 64, 71, 73, 91, 97, 113,
    # Batch 10
    122, 134, 152, 209, 221, 240, 287, 435, 738, 763,
]


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
