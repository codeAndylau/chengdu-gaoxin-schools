# South Gate · 开口小说

给口语用的英语材料。不是用来默读的小说。

学习链接（push `main` 后生效）：

https://codeandylau.github.io/chengdu-gaoxin-schools/english/

## 怎么练

1. 打开链接，选「跟读」：听一句，马上说一句。
2. 「你先说」：先开口，卡住再听原句。
3. 「口块」：只练 8～12 句今天能用的话。
4. 「角色扮演」：不看原文，按任务自己说。

## 怎么续写

```bash
python3 scripts/english_oral_novel.py prompt
python3 scripts/english_oral_novel.py write   # 需要 OPENAI_API_KEY
python3 scripts/english_oral_novel.py build
python3 -m unittest scripts.test_english_oral_novel
```

硬规则在 `WRITING_SPEC.md`：说不出口的句子不准进章节。
