#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
根据 data/index.json 批量生成 data/problems/{id}.json。
调用 OpenAI 兼容 API（需配置 OPENAI_API_KEY / OPENAI_BASE_URL / MODEL）。
支持断点续跑、失败重试、范围过滤。
"""
import json
import os
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX_PATH = ROOT / "data" / "index.json"
OUT_DIR = ROOT / "data" / "problems"

API_KEY = os.environ.get("OPENAI_API_KEY", "")
BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
MODEL = os.environ.get("MODEL", "gpt-4o-mini")
MAX_RETRIES = int(os.environ.get("MAX_RETRIES", "3"))


def load_index():
    with open(INDEX_PATH, "r", encoding="utf-8") as f:
        return json.load(f)["problems"]


def build_prompt(problem):
    return f"""请你为 LeetCode 题目生成完整的中文题面与三档解法 JSON。

题目信息：
- 题号：{problem['id']}
- 中文标题：{problem['title']}
- 英文标题：{problem['titleEn']}
- 难度：{problem['difficulty']}
- 标签：{', '.join(problem['tags'])}

要求：
1. 严格按以下 JSON schema 输出，不要包含任何 schema 外的字段或 markdown 代码块标记。
2. 字段要求：
   - id: 整数，填 {problem['id']}
   - title: 中文标题
   - titleEn: 英文标题
   - difficulty: "简单" | "中等" | "困难"，与题目信息一致
   - tags: 字符串数组，从题目标签里选 1-4 个最贴切的
   - description: 中文题面描述，清晰完整，不要直接复制 LeetCode 原文，用自己的话改写
   - examples: 数组，每个元素含 input / output / explanation（explanation 可选但建议有）
   - constraints: 字符串数组，约束条件
   - ioFormat: 可选字符串，说明输入/输出格式；如果是函数式题目则省略
   - solutions: 数组，恰好三个元素，分别对应 level="暴力" / "优化" / "最优"
     * level: 固定为 "暴力" / "优化" / "最优"
     * idea: 中文思路说明，必须解释清楚为什么比上一档好
     * code: Python3 ACM 模式完整可运行程序，包含 stdin 读取与 main，严禁只给函数骨架
3. 三档解法的复杂度必须真正递进：
   - 暴力：最直观但低效，保证能 AC 小数据
   - 优化：明显降低复杂度，使用哈希表/排序/滑动窗口等常用技巧
   - 最优：该问题面试期望的最优解
4. 代码中只使用标准库，输入输出用 sys.stdin.readline 读取。
5. 输出必须是合法 JSON，可被 json.loads 直接解析。

请直接输出 JSON：
"""


def parse_json(text):
    text = text.strip()
    # 尝试去掉 ```json ... ``` 包裹
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.I)
        text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def call_api(prompt):
    try:
        import openai
    except ImportError as e:
        raise RuntimeError("请先安装 openai 库: pip install openai") from e

    client = openai.OpenAI(api_key=API_KEY, base_url=BASE_URL)
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": "你是一个专业的算法题出题助手，只输出合法 JSON。"},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.4,
                max_tokens=2500,
            )
            content = resp.choices[0].message.content
            return parse_json(content)
        except Exception as e:
            print(f"  API 调用失败（第 {attempt}/{MAX_RETRIES} 次）: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(2 ** attempt)
            else:
                raise


def generate_one(problem):
    print(f"生成 {problem['id']:>4} - {problem['title']}")
    prompt = build_prompt(problem)
    detail = call_api(prompt)
    # 回填标准字段，确保一致性
    detail["id"] = problem["id"]
    detail["title"] = problem["title"]
    detail["titleEn"] = problem["titleEn"]
    detail["difficulty"] = problem["difficulty"]
    detail["tags"] = problem["tags"]
    return detail


def save_detail(detail):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / f"{detail['id']}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(detail, f, ensure_ascii=False, indent=2)


def main():
    if not API_KEY:
        print("错误：未设置 OPENAI_API_KEY 环境变量。")
        print("示例：export OPENAI_API_KEY=sk-xxxx")
        print("可选：export OPENAI_BASE_URL=https://api.openai.com/v1")
        print("可选：export MODEL=gpt-4o-mini")
        sys.exit(1)

    problems = load_index()

    # 支持按题号范围或指定 id 生成：python gen_problems.py [start_id] [end_id]
    start_id = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    end_id = int(sys.argv[2]) if len(sys.argv) > 2 else 10 ** 9

    todo = [p for p in problems if start_id <= p["id"] <= end_id]
    existing_ids = {int(p.stem) for p in OUT_DIR.glob("*.json")}
    todo = [p for p in todo if p["id"] not in existing_ids]

    print(f"总计 {len(problems)} 题；本次待生成 {len(todo)} 题（已跳过 {len(existing_ids)} 个已有文件）")

    failed = []
    for problem in todo:
        try:
            detail = generate_one(problem)
            save_detail(detail)
            time.sleep(0.5)
        except Exception as e:
            print(f"  ❌ 失败：{e}")
            failed.append(problem)

    print(f"\n完成：生成 {len(todo) - len(failed)} 题，失败 {len(failed)} 题")
    if failed:
        print("失败的题号：", ", ".join(str(p["id"]) for p in failed))
        sys.exit(2)


if __name__ == "__main__":
    main()
