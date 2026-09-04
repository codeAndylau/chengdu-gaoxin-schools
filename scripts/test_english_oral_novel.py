import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from english_oral_novel import parse_chapter, speakability_issues


SAMPLE = """# Chapter 01: The Wrong Order

id: 01
title: The Wrong Order
minutes: 6
scene: A busy coffee shop near an office in Chengdu
functions: greetings, ordering, apologizing, small talk, making a plan

## Story

[narration] Monday morning. Lin is late.
Lin: One oat latte to go, please.
Barista: Name?
Lin: Lin.
Alex: Sorry. I think that's mine.
Lin: Oh. My bad. Here you go.

## Say These

- I think that's mine. | 我觉得那是我的。
- My bad. | 是我的错 / 抱歉。

## Role Play

You picked up the wrong coffee. Apologize and give it back.

## Notes

- to go | 外带。
- My bad. | 比 Sorry 更随便的认错。
"""


class ParseChapterTest(unittest.TestCase):
    def test_parses_metadata_story_and_practice(self):
        chapter = parse_chapter(SAMPLE)

        self.assertEqual(chapter["id"], "01")
        self.assertEqual(chapter["title"], "The Wrong Order")
        self.assertEqual(chapter["minutes"], 6)
        self.assertEqual(chapter["functions"][0], "greetings")
        self.assertEqual(chapter["story"][0]["type"], "narration")
        self.assertEqual(chapter["story"][1]["speaker"], "Lin")
        self.assertEqual(chapter["story"][1]["text"], "One oat latte to go, please.")
        self.assertEqual(chapter["phrases"][0]["en"], "I think that's mine.")
        self.assertIn("wrong coffee", chapter["role_play"][0])
        self.assertEqual(chapter["notes"][0]["en"], "to go")

    def test_rejects_unspeakable_lines(self):
        issues = speakability_issues(
            parse_chapter(
                SAMPLE.replace(
                    "Lin: One oat latte to go, please.",
                    "Lin: Having been delayed by unforeseen traffic, I would like to procure a beverage.",
                )
            )
        )
        self.assertTrue(any("too long" in issue or "not spoken" in issue for issue in issues))


class RealChapterTest(unittest.TestCase):
    def test_all_chapters_are_speakable(self):
        paths = sorted(
            (Path(__file__).resolve().parents[1] / "english-oral-novel" / "chapters").glob("*.md")
        )
        self.assertGreaterEqual(len(paths), 2)
        for path in paths:
            with self.subTest(path.name):
                chapter = parse_chapter(path.read_text(encoding="utf-8"))
                self.assertEqual(speakability_issues(chapter), [])
                dialogue = [line for line in chapter["story"] if line["type"] == "dialogue"]
                self.assertGreaterEqual(len(dialogue) / max(len(chapter["story"]), 1), 0.75)
                self.assertGreaterEqual(len(chapter["phrases"]), 8)
                self.assertLessEqual(len(chapter["phrases"]), 12)


if __name__ == "__main__":
    unittest.main()
