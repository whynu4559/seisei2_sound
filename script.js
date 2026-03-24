const tabList = document.getElementById("tab-list");
const grid = document.getElementById("pad-grid");
const stopAllButton = document.getElementById("stop-all");

const SOUND_FILES = [
  "生成音声/s1_★みらい.wav",
  "生成音声/s1_ききみみ.wav",
  "生成音声/s1_さめ.wav",
  "生成音声/s1_たわー.wav",
  "生成音声/s1_だがっき.wav",
  "生成音声/s1_ていし.wav",
  "生成音声/s1_とらいあすろん.wav",
  "生成音声/s1_ぷらいず.wav",
  "生成音声/s1_みりん.wav",
  "生成音声/s2_★すてき.wav",
  "生成音声/s2_いきもの.wav",
  "生成音声/s2_いのり.wav",
  "生成音声/s2_おやこ_0.wav",
  "生成音声/s2_こうがい.wav",
  "生成音声/s2_すきる.wav",
  "生成音声/s2_のろま.wav",
  "生成音声/s2_まっくす.wav",
  "生成音声/s2_りせい.wav",
  "生成音声/s3_1_まるち.wav",
  "生成音声/s3_2_ちゃーはん.wav",
  "生成音声/s3_3_わたがし.wav",
  "生成音声/s3_4_まいこ.wav",
  "生成音声/s3_★かいしょう.wav",
  "生成音声/s3_★すもも.wav",
];

const SERIES_ORDER = ["s1", "s2", "s3"];

function getBaseName(path) {
  return path.split("/").pop() || path;
}

function removeExtension(fileName) {
  return fileName.replace(/\.[^.]+$/, "");
}

function getSeries(stem) {
  const match = stem.match(/^(s[123])_/i);
  return match ? match[1].toLowerCase() : "";
}

function extractLabel(stem) {
  const japaneseParts = stem.match(/[ぁ-んァ-ヶー一-龠々]+/g);
  if (japaneseParts?.length) {
    return japaneseParts[japaneseParts.length - 1];
  }

  const segments = stem.split("_");
  return segments[segments.length - 1] || stem;
}

function isStarred(stem) {
  return stem.includes("★");
}

function getS3Order(stem) {
  const match = stem.match(/^s3_(\d+)_/i);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function buildPad(path) {
  const fileName = getBaseName(path);
  const stem = removeExtension(fileName);
  const normalizedStem = stem.normalize("NFC");
  const series = getSeries(normalizedStem);
  const label = extractLabel(normalizedStem);
  const loop = label === "かいしょう";
  const audio = new Audio(encodeURI(`./${path}`));

  audio.preload = "auto";
  audio.loop = loop;

  return {
    id: path,
    series,
    label,
    starred: isStarred(normalizedStem),
    order: getS3Order(normalizedStem),
    loop,
    audio,
    button: null,
  };
}

function sortPads(series, padsForSeries) {
  return [...padsForSeries].sort((a, b) => {
    if (a.starred !== b.starred) {
      return a.starred ? 1 : -1;
    }

    if (series === "s3") {
      const aHasOrder = Number.isFinite(a.order);
      const bHasOrder = Number.isFinite(b.order);

      if (aHasOrder !== bHasOrder) {
        return aHasOrder ? -1 : 1;
      }

      if (aHasOrder && bHasOrder && a.order !== b.order) {
        return a.order - b.order;
      }
    }

    return a.label.localeCompare(b.label, "ja");
  });
}

const pads = SOUND_FILES.map(buildPad).filter((pad) => SERIES_ORDER.includes(pad.series));
const padsBySeries = SERIES_ORDER.reduce((acc, series) => {
  acc[series] = [];
  return acc;
}, {});

pads.forEach((pad) => {
  padsBySeries[pad.series].push(pad);
});

SERIES_ORDER.forEach((series) => {
  padsBySeries[series] = sortPads(series, padsBySeries[series]);
});

let activeSeries = SERIES_ORDER.find((series) => padsBySeries[series].length > 0) || "s1";

function updatePadButton(pad) {
  if (!pad.button) return;

  pad.button.classList.toggle("playing", !pad.audio.paused);
  pad.button.classList.toggle("loop", pad.loop);
  pad.button.textContent = pad.label;
}

function stopPad(pad) {
  pad.audio.pause();
  pad.audio.currentTime = 0;
  updatePadButton(pad);
}

async function togglePlayback(pad) {
  if (!pad.audio.paused) {
    stopPad(pad);
    return;
  }

  try {
    await pad.audio.play();
    updatePadButton(pad);
  } catch (_error) {
    window.alert(`「${pad.label}」を再生できませんでした。`);
  }
}

function stopAll() {
  pads.forEach((pad) => {
    stopPad(pad);
  });
}

function createTabButton(series) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tab-button";
  button.textContent = series.toUpperCase();
  button.setAttribute("role", "tab");
  button.setAttribute("aria-selected", String(series === activeSeries));

  if (series === activeSeries) {
    button.classList.add("active");
  }

  button.addEventListener("click", () => {
    if (activeSeries === series) return;
    activeSeries = series;
    renderTabs();
    renderPads();
  });

  return button;
}

function renderTabs() {
  tabList.innerHTML = "";

  SERIES_ORDER.forEach((series) => {
    if (!padsBySeries[series].length) return;
    tabList.appendChild(createTabButton(series));
  });
}

function renderPads() {
  grid.innerHTML = "";
  const fragment = document.createDocumentFragment();
  const currentPads = padsBySeries[activeSeries] || [];

  currentPads.forEach((pad) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pad-button";
    button.title = pad.loop ? "ループ音源" : "";
    button.addEventListener("click", () => {
      togglePlayback(pad);
    });

    pad.button = button;
    updatePadButton(pad);
    fragment.appendChild(button);
  });

  grid.appendChild(fragment);
}

pads.forEach((pad) => {
  pad.audio.addEventListener("ended", () => {
    updatePadButton(pad);
  });
  pad.audio.addEventListener("pause", () => {
    updatePadButton(pad);
  });
});

stopAllButton.addEventListener("click", stopAll);

window.addEventListener("beforeunload", () => {
  stopAll();
});

renderTabs();
renderPads();
