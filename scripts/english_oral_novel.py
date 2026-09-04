#!/usr/bin/env python3
"""Compile speakable English-oral-novel chapters into the GitHub Pages reader."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NOVEL_DIR = ROOT / "english-oral-novel"
CHAPTERS_DIR = NOVEL_DIR / "chapters"
PUBLIC_ENGLISH = ROOT / "public" / "english"
VOCAB_DEFAULT = Path("/Users/mac/Desktop/loop-agent/English_Master_3500_Daily_Conversation.md")

UNSPEAKABLE = (
    "procure",
    "unforeseen",
    "hence",
    "therefore",
    "utilize",
    "commence",
    "regarding",
    "furthermore",
    "whom",
    "shall",
    "thus",
    "nevertheless",
    "aforementioned",
)


def parse_chapter(source: str) -> dict:
    text = source if isinstance(source, str) else Path(source).read_text(encoding="utf-8")
    lines = text.splitlines()
    chapter: dict = {
        "id": "",
        "title": "",
        "minutes": 0,
        "scene": "",
        "functions": [],
        "story": [],
        "phrases": [],
        "role_play": [],
        "notes": [],
    }

    if lines and lines[0].startswith("# "):
        heading = lines[0][2:].strip()
        chapter["title"] = heading.split(":", 1)[-1].strip() or heading

    section = "meta"
    for raw in lines[1:]:
        line = raw.rstrip()
        if line.startswith("## "):
            name = line[3:].strip().lower()
            if name == "story":
                section = "story"
            elif name == "say these":
                section = "phrases"
            elif name == "role play":
                section = "role_play"
            elif name == "notes":
                section = "notes"
            else:
                section = "meta"
            continue

        if not line.strip():
            continue

        if section == "meta":
            key, _, value = line.partition(":")
            key = key.strip().lower()
            value = value.strip()
            if key == "functions":
                chapter["functions"] = [part.strip() for part in value.split(",") if part.strip()]
            elif key == "minutes":
                chapter["minutes"] = int(value)
            elif key in chapter:
                chapter[key] = value
            continue

        if section == "story":
            if line.startswith("[narration]"):
                chapter["story"].append(
                    {"type": "narration", "speaker": "", "text": line[len("[narration]") :].strip()}
                )
                continue
            speaker, sep, spoken = line.partition(":")
            if sep and speaker.strip() and " " not in speaker.strip():
                chapter["story"].append(
                    {"type": "dialogue", "speaker": speaker.strip(), "text": spoken.strip()}
                )
            else:
                chapter["story"].append({"type": "narration", "speaker": "", "text": line.strip()})
            continue

        if section == "phrases" and line.startswith("- "):
            en, _, zh = line[2:].partition("|")
            chapter["phrases"].append({"en": en.strip(), "zh": zh.strip()})
            continue

        if section == "notes" and line.startswith("- "):
            en, _, zh = line[2:].partition("|")
            chapter["notes"].append({"en": en.strip(), "zh": zh.strip()})
            continue

        if section == "role_play":
            chapter["role_play"].append(line.strip())

    return chapter


def _word_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z']+", text))


def speakability_issues(chapter: dict) -> list[str]:
    issues: list[str] = []
    for index, line in enumerate(chapter["story"]):
        text = line["text"]
        limit = 12 if line["type"] == "narration" else 14
        count = _word_count(text)
        if count > limit:
            issues.append(f"line {index} too long ({count} words): {text}")
        lowered = text.lower()
        for word in UNSPEAKABLE:
            if re.search(rf"\b{word}\b", lowered):
                issues.append(f"line {index} not spoken: '{word}' in {text}")
        if line["type"] == "dialogue" and ";" in text:
            issues.append(f"line {index} not spoken: too written: {text}")
    return issues


def load_chapters() -> list[dict]:
    chapters = []
    for path in sorted(CHAPTERS_DIR.glob("*.md")):
        chapter = parse_chapter(path.read_text(encoding="utf-8"))
        chapter["source"] = path.name
        issues = speakability_issues(chapter)
        if issues:
            raise SystemExit(f"{path.name} is not speakable:\n- " + "\n- ".join(issues))
        chapters.append(chapter)
    return chapters


def build() -> Path:
    chapters = load_chapters()
    PUBLIC_ENGLISH.mkdir(parents=True, exist_ok=True)
    out = PUBLIC_ENGLISH / "chapters.json"
    payload = {
        "level": "B1-B2",
        "purpose": "Speak these lines out loud. If you would not say it today, it does not belong here.",
        "chapters": chapters,
    }
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return out


def sample_vocab(limit: int = 40) -> list[str]:
    path = VOCAB_DEFAULT
    if not path.exists():
        return []
    words = []
    for line in path.read_text(encoding="utf-8").splitlines():
        match = re.match(r"^# \d+ (.+)$", line.strip())
        if match:
            words.append(match.group(1).strip())
        if len(words) >= 800:
            break
    step = max(len(words) // limit, 1)
    return words[::step][:limit]


def next_prompt() -> str:
    bible = (NOVEL_DIR / "bible.json").read_text(encoding="utf-8")
    spec = (NOVEL_DIR / "WRITING_SPEC.md").read_text(encoding="utf-8")
    existing = sorted(CHAPTERS_DIR.glob("*.md"))
    previous = existing[-1].read_text(encoding="utf-8") if existing else "(none)"
    vocab = ", ".join(sample_vocab())
    next_id = f"{len(existing) + 1:02d}"
    return f"""Write the next speakable chapter for an English speaking-practice serial.

Hard rule: every dialogue line must be something a real person would say today, out loud, in that situation. No textbook English. No novel narration.

Next chapter id: {next_id}
Prefer these daily words when natural: {vocab}

# Spec
{spec}

# Bible
{bible}

# Previous chapter
{previous}

Output markdown in the exact chapter format from the spec. Keep 75%+ dialogue. Max 14 words per spoken line. 8-12 say-these chunks.
"""


def write_with_llm(prompt: str) -> str:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise SystemExit("OPENAI_API_KEY is not set. Use `prompt` and paste into your model, or export the key.")
    body = json.dumps(
        {
            "model": os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"),
            "input": prompt,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as error:
        raise SystemExit(f"LLM request failed: {error}") from error
    texts = []
    for item in payload.get("output", []):
        for content in item.get("content", []):
            if content.get("type") in {"output_text", "text"} and content.get("text"):
                texts.append(content["text"])
    if not texts and payload.get("output_text"):
        texts.append(payload["output_text"])
    if not texts:
        raise SystemExit(f"Unexpected LLM response: {json.dumps(payload)[:800]}")
    return "\n".join(texts).strip() + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Speakable English oral-novel toolchain")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("build", help="Compile chapters into public/english/chapters.json")
    sub.add_parser("prompt", help="Print the next-chapter writing prompt")
    write = sub.add_parser("write", help="Generate the next chapter with OPENAI_API_KEY")
    write.add_argument("--out", help="Optional markdown output path")
    args = parser.parse_args(argv)

    if args.command == "build":
        path = build()
        print(path)
        return 0
    if args.command == "prompt":
        sys.stdout.write(next_prompt())
        return 0
    if args.command == "write":
        markdown = write_with_llm(next_prompt())
        chapter = parse_chapter(markdown)
        issues = speakability_issues(chapter)
        if issues:
            raise SystemExit("Generated chapter failed speakability:\n- " + "\n- ".join(issues))
        out = Path(args.out) if args.out else CHAPTERS_DIR / f"{chapter['id']}-{slug(chapter['title'])}.md"
        out.write_text(markdown if markdown.endswith("\n") else markdown + "\n", encoding="utf-8")
        print(out)
        build()
        return 0
    return 1


def slug(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")


if __name__ == "__main__":
    raise SystemExit(main())
