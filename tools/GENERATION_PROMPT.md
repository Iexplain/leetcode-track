# 力扣刷题 PWA 题目数据生成 Prompt

把这个提示词喂给任意大模型（ChatGPT / DeepSeek / Claude / Gemini 等），让它批量生成符合本项目 schema 的题目 JSON。

## 角色

你是一名资深算法竞赛出题人 + Python 技术专家。你的任务是把 LeetCode 题目的**题号、标题、难度、标签**作为输入，生成完整的中文题面 + 三档递进解法（暴力 / 优化 / 最优），输出为严格合法的 JSON。

## 项目背景

- 目标：为纯静态 PWA 提供题目数据，无后端，直接读本地 JSON。
- 文件拆分：
  - `data/index.json`：题目清单（id, title, titleEn, difficulty, tags）。
  - `data/problems/{id}.json`：每道题的完整详情。
- 每道题都必须能离线渲染在移动端浏览器里，解法代码必须是 **ACM 模式 Python3 完整可运行程序**。

## 输出 JSON Schema

```json
{
  "id": 1,
  "title": "中文标题",
  "titleEn": "English Title",
  "difficulty": "简单 | 中等 | 困难",
  "tags": ["数组", "哈希表"],
  "description": "中文题面描述，用自己的话改写，不要直接复制 LeetCode 官网原文。",
  "examples": [
    {
      "input": "输入样例文本",
      "output": "输出样例文本",
      "explanation": "解释（可选但建议有）"
    }
  ],
  "constraints": [
    "1 <= n <= 10^5",
    "..."
  ],
  "ioFormat": "说明输入/输出格式；如果是纯函数式题目（如只返回 bool），可省略或写一行说明。",
  "solutions": [
    {
      "level": "暴力",
      "idea": "用最直白、最容易想到的方法说明，保证能过但通常复杂度差。",
      "code": "import sys\n\ndef solve(nums, target):\n    ...\n\nif __name__ == '__main__':\n    ...\n    print(result)\n"
    },
    {
      "level": "优化",
      "idea": "在暴力基础上做常见优化，明显降低复杂度。",
      "code": "..."
    },
    {
      "level": "最优",
      "idea": "面试期望的标准最优解，时间/空间都达到该问题的最优界。",
      "code": "..."
    }
  ]
}
```

## 关键要求

### 1. 题面描述
- 用中文，清晰、完整、有示例说明。
- **不要直接复制 LeetCode 官网原文**，用自己的话改写，避免版权风险。
- 如果是函数式题目（如返回索引），请补充说明输入/输出如何对应 ACM 模式。

### 2. 三档解法必须真正递进
| 档位 | 复杂度定位 | 代码要求 |
|---|---|---|
| 暴力 | 最直观、能 AC 小数据、通常时间/空间差 | 直接按题意模拟、枚举 |
| 优化 | 明显下降复杂度 | 使用哈希表、排序、滑动窗口、前缀和等常见技巧 |
| 最优 | 面试期望的标准解 | 时间/空间达到该问题最优界 |

**严禁三档解法雷同**。每档的 `idea` 必须清楚解释“为什么比上一档好”。

### 3. 代码必须是 ACM 模式 Python3 完整程序
- 必须包含 `import sys` 和标准输入读取。
- 必须包含 `if __name__ == '__main__':`。
- 不能只是函数骨架，必须是能直接复制到本地运行的完整程序。
- 只使用 Python 标准库，不使用 numpy/pandas 等第三方库。
- 输入读取推荐用 `sys.stdin.read().strip().split()` 或 `sys.stdin.readline()`。

### 4. JSON 输出要求
- 必须合法，可被 `json.loads` 直接解析。
- 不要输出 markdown 代码块标记（如 ```json），只输出纯 JSON 文本。
- 字符串中所有双引号必须正确转义，代码中的换行保留为 `\n`。
- `difficulty` 只能是 **简单 / 中等 / 困难** 之一。
- `solutions` 必须恰好 3 个元素，level 分别为 **暴力 / 优化 / 最优**。

### 5. 输入格式
我会一次性给你多道题的清单，格式如下：

```text
1 | Two Sum | 简单 | 数组, 哈希表
15 | 3Sum | 中等 | 数组, 双指针, 排序
...
```

每道题占一行，包含：`题号 | 英文标题 | 难度 | 标签`。

### 6. 批量输出格式
对每一道题，输出一个独立的 JSON 对象。推荐把多个 JSON 对象放进一个 JSON 数组：

```json
[
  { /* 第1题 */ },
  { /* 第2题 */ },
  ...
]
```

也可以逐题输出：`{ /* 第1题 */ }`，然后 `{ /* 第2题 */ }`，我会自行拆分保存。

## 给你一个示范输入

```text
1 | Two Sum | 简单 | 数组, 哈希表
88 | Merge Sorted Array | 简单 | 数组, 双指针, 排序
```

## 期望输出示例（部分）

```json
{
  "id": 88,
  "title": "合并两个有序数组",
  "titleEn": "Merge Sorted Array",
  "difficulty": "简单",
  "tags": ["数组", "双指针", "排序"],
  "description": "给你两个按非递减顺序排列的整数数组 nums1 和 nums2...",
  "examples": [
    {
      "input": "3 3\n1 2 3\n2 5 6",
      "output": "1 2 2 3 5 6",
      "explanation": "合并后得到有序数组 [1,2,2,3,5,6]。"
    }
  ],
  "constraints": ["nums1.length == m + n", "..."],
  "ioFormat": "第一行 m n；第二行 nums1 有效元素；第三行 nums2。输出合并后的 nums1。",
  "solutions": [
    {
      "level": "暴力",
      "idea": "把 nums2 复制到 nums1 末尾，再整体排序。时间 O((m+n)log(m+n))，未利用已有序。",
      "code": "import sys\n\ndef merge(nums1, m, nums2, n):\n    for i in range(n):\n        nums1[m+i] = nums2[i]\n    nums1.sort()\n\nif __name__ == '__main__':\n    data = sys.stdin.read().strip().split()\n    it = iter(data)\n    m = int(next(it)); n = int(next(it))\n    nums1 = [0]*(m+n)\n    for i in range(m): nums1[i] = int(next(it))\n    nums2 = [int(next(it)) for _ in range(n)]\n    merge(nums1, m, nums2, n)\n    print(' '.join(map(str, nums1)))\n"
    },
    {
      "level": "优化",
      "idea": "双指针从头比较，先放入临时数组，再复制回 nums1。时间 O(m+n)，但空间 O(m+n)。",
      "code": "..."
    },
    {
      "level": "最优",
      "idea": "双指针从后向前填充 nums1，直接利用尾部空位，时间 O(m+n)，空间 O(1)。",
      "code": "..."
    }
  ]
}
```

## 现在开始

请按上面的 schema 和要求，为下面列出的每一道题生成完整 JSON：

```text
{在这里粘贴你的题目清单}
```
