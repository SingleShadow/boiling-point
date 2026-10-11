#!/usr/bin/env python3
"""把 agents/<slug>/ 下的身份文件打包成标准 .skill 包。

目录约定:
    agents/<slug>/
        SKILL.md                  <- 安装说明（必需）
        SOUL.md IDENTITY.md       <- 身份文件
        AGENTS.md PLAYBOOK.md     <- 工作规则与方法论
    ->  agents/<slug>/dist/<slug>.skill

用法:
    python agents/build.py

产物结构（zip）:
    <slug>/SKILL.md
    <slug>/assets/workspace-template/{SOUL,IDENTITY,AGENTS,PLAYBOOK}.md
"""

import os
import pathlib
import sys
import zipfile

ROOT = pathlib.Path(__file__).parent.resolve()
SKIP_DIRS = {"dist", "samples", "__pycache__", "_template", "node_modules"}
IDENTITY_FILES = ["SOUL.md", "IDENTITY.md", "AGENTS.md", "PLAYBOOK.md"]


def build(agent_dir: pathlib.Path):
    slug = agent_dir.name
    skill_md = agent_dir / "SKILL.md"
    if not skill_md.exists():
        print(f"  SKIP  {slug}  缺 SKILL.md")
        return None

    out_dir = agent_dir / "dist"
    out_dir.mkdir(exist_ok=True)
    out = out_dir / f"{slug}.skill"

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(skill_md, f"{slug}/SKILL.md")
        for name in IDENTITY_FILES:
            p = agent_dir / name
            if p.exists():
                z.write(p, f"{slug}/assets/workspace-template/{name}")

    with zipfile.ZipFile(out) as z:
        count = len(z.namelist())
    return out, count


def main() -> int:
    print(f"打包目录: {ROOT}\n")
    total = 0
    for d in sorted(ROOT.iterdir()):
        if not d.is_dir() or d.name in SKIP_DIRS or d.name.startswith("."):
            continue
        result = build(d)
        if result:
            out, count = result
            rel = out.relative_to(ROOT)
            print(f"  OK    {d.name:<22} -> {rel}  ({count} 文件, {out.stat().st_size} bytes)")
            total += 1

    print(f"\n共打包 {total} 个 Agent")
    return 0 if total else 1


if __name__ == "__main__":
    sys.exit(main())
