const state = {
  data: null,
  chapterIndex: 0,
  lineIndex: 0,
  mode: "shadow",
  showMeaning: false,
};

const stage = document.querySelector("#stage");
const chapterSelect = document.querySelector("#chapter-select");

const meaningFor = (chapter, line) => {
  if (line.type !== "dialogue") return "先听场景，下一句就要开口。";
  const hit = [...chapter.phrases, ...chapter.notes].find((item) =>
    line.text.includes(item.en.replace(/\.$/, "")) || item.en.includes(line.text.replace(/\.$/, ""))
  );
  return hit ? hit.zh : "把这句原样说出来。不要改成书面语。";
};

const speak = (text) => {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.92;
  window.speechSynthesis.speak(utterance);
};

const chapter = () => state.data.chapters[state.chapterIndex];

const renderSelect = () => {
  chapterSelect.innerHTML = `
    <label for="chapter">今天练哪一章</label>
    <select id="chapter">
      ${state.data.chapters
        .map(
          (item, index) =>
            `<option value="${index}" ${index === state.chapterIndex ? "selected" : ""}>${item.id} · ${item.title} · ${item.scene}</option>`
        )
        .join("")}
    </select>
    <p class="progress">${chapter().functions.join(" · ")}</p>
  `;
  chapterSelect.querySelector("select").onchange = (event) => {
    state.chapterIndex = Number(event.target.value);
    state.lineIndex = 0;
    state.showMeaning = false;
    render();
  };
};

const renderShadow = () => {
  const lines = chapter().story;
  const line = lines[state.lineIndex];
  const last = state.lineIndex >= lines.length - 1;
  const prompt =
    state.mode === "you-say" && line.type === "dialogue"
      ? "先自己说。卡住再点「听原句」。"
      : "听完立刻跟读。嘴巴要动。";
  stage.innerHTML = `
    <p class="progress">${state.lineIndex + 1} / ${lines.length} · ${prompt}</p>
    <p class="speaker">${line.type === "dialogue" ? line.speaker : "场景"}</p>
    <p class="line ${line.type === "narration" ? "narration" : ""}">${
      state.mode === "you-say" && line.type === "dialogue" && !state.showMeaning
        ? "你来：这句在这个场景里该怎么说？"
        : line.text
    }</p>
    <p class="meaning">${state.showMeaning ? meaningFor(chapter(), line) : ""}</p>
    <div class="row">
      <button class="btn primary" data-act="hear" type="button">听原句</button>
      <button class="btn" data-act="meaning" type="button">${state.showMeaning ? "藏提示" : "看中文"}</button>
      <button class="btn" data-act="next" type="button">${last ? "再来一遍" : "下一句"}</button>
    </div>
  `;
};

const renderChunks = () => {
  stage.innerHTML = `
    <p class="progress">这些句子拿起来就能用。点一下，跟着说。</p>
    ${chapter()
      .phrases.map(
        (item, index) =>
          `<button class="chunk" data-say="${index}" type="button"><b>${item.en}</b>${item.zh}</button>`
      )
      .join("")}
  `;
};

const renderRole = () => {
  stage.innerHTML = `
    <p class="progress">不要念稿。看任务，自己说完整句。</p>
    ${chapter()
      .role_play.map((item) => `<div class="task">${item}</div>`)
      .join("")}
    <div class="row">
      <button class="btn primary" data-act="hear-first-phrase" type="button">卡住了，听一口块</button>
    </div>
  `;
};

const render = () => {
  if (state.mode === "chunks") renderChunks();
  else if (state.mode === "role") renderRole();
  else renderShadow();
};

const onStageClick = (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const lines = chapter().story;
  const line = lines[state.lineIndex];
  if (button.dataset.act === "hear") {
    const text = line.type === "dialogue" ? line.text : line.text;
    if (state.mode === "you-say") state.showMeaning = true;
    speak(text);
    render();
  }
  if (button.dataset.act === "meaning") {
    state.showMeaning = !state.showMeaning;
    render();
  }
  if (button.dataset.act === "next") {
    state.lineIndex = state.lineIndex >= lines.length - 1 ? 0 : state.lineIndex + 1;
    state.showMeaning = false;
    render();
  }
  if (button.dataset.act === "hear-first-phrase") {
    speak(chapter().phrases[0].en);
  }
  if (button.dataset.say) {
    const phrase = chapter().phrases[Number(button.dataset.say)];
    speak(phrase.en);
  }
};

const boot = async () => {
  try {
    const response = await fetch("./chapters.json", { cache: "no-store" });
    if (!response.ok) throw new Error(String(response.status));
    state.data = await response.json();
  } catch (error) {
    stage.innerHTML = `<p>学习页需要通过网站打开，不能直接丢到微信文件里离线乱点。发布后用 GitHub Pages 链接。</p><p class="meaning">${error}</p>`;
    return;
  }
  renderSelect();
  render();
};

document.querySelectorAll(".mode").forEach((button) => {
  button.onclick = () => {
    document.querySelectorAll(".mode").forEach((item) => item.classList.toggle("is-on", item === button));
    state.mode = button.dataset.mode;
    state.lineIndex = 0;
    state.showMeaning = false;
    render();
  };
});

stage.addEventListener("click", onStageClick);
boot();
