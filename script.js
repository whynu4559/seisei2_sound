const padTemplate = document.getElementById("pad-template");
const grid = document.getElementById("pad-grid");
const padCountSelect = document.getElementById("pad-count");
const stopAllButton = document.getElementById("stop-all");
const saveRecordingsButton = document.getElementById("save-recordings");
const micToggleButton = document.getElementById("mic-toggle");
const loadZipButton = document.getElementById("load-zip");
const loadFolderButton = document.getElementById("load-folder");
const zipInput = document.getElementById("zip-input");
const folderInput = document.getElementById("folder-input");

const padStates = [];
let padCount = Number(padCountSelect.value);
let activeRecordingState = null;
let sharedMicStream = null;
let isMicConnecting = false;

function canRecordAudio() {
  return Boolean(window.MediaRecorder && navigator.mediaDevices?.getUserMedia);
}

function canExportZip() {
  return Boolean(window.JSZip);
}

function hasActiveMicStream() {
  if (!sharedMicStream) return false;
  return sharedMicStream
    .getAudioTracks()
    .some((track) => track.readyState === "live");
}

function updateMicToggleButton() {
  if (!micToggleButton) return;

  if (!canRecordAudio()) {
    micToggleButton.disabled = true;
    micToggleButton.textContent = "録音非対応";
    return;
  }

  if (isMicConnecting) {
    micToggleButton.disabled = true;
    micToggleButton.textContent = "マイク接続中...";
    return;
  }

  micToggleButton.disabled = false;
  micToggleButton.textContent = hasActiveMicStream()
    ? "マイク切断"
    : "マイク接続";
}

async function ensureMicStream() {
  if (hasActiveMicStream()) {
    return sharedMicStream;
  }

  isMicConnecting = true;
  updateMicToggleButton();
  refreshRecordButtons();

  try {
    sharedMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    sharedMicStream.getAudioTracks().forEach((track) => {
      track.onended = () => {
        sharedMicStream = null;
        updateMicToggleButton();
        refreshRecordButtons();
      };
    });
    return sharedMicStream;
  } finally {
    isMicConnecting = false;
    updateMicToggleButton();
    refreshRecordButtons();
  }
}

function disconnectMicStream() {
  if (!sharedMicStream) {
    updateMicToggleButton();
    return;
  }

  sharedMicStream.getTracks().forEach((track) => track.stop());
  sharedMicStream = null;
  updateMicToggleButton();
  refreshRecordButtons();
}

async function toggleMicConnection() {
  if (activeRecordingState) {
    window.alert("録音中はマイクを切断できません。");
    return;
  }

  if (hasActiveMicStream()) {
    disconnectMicStream();
    return;
  }

  try {
    await ensureMicStream();
  } catch (_error) {
    window.alert("マイク許可が必要です。ブラウザ設定を確認してください。");
  }
}

function getDisplayName(state) {
  const custom = state.name?.trim();
  return custom || `Pad ${state.id}`;
}

function resetAudio(state) {
  if (!state.audio) return;
  state.audio.pause();
  state.audio.currentTime = 0;
}

function updatePadVisual(state) {
  const button = state.refs.padButton;
  const displayName = getDisplayName(state);
  button.classList.remove("ready", "playing");

  if (!state.audio) {
    button.textContent = displayName;
    return;
  }

  button.classList.add("ready");
  button.textContent = state.audio.paused
    ? displayName
    : `Stop ${displayName}`;

  if (!state.audio.paused) {
    button.classList.add("playing");
  }
}

function setStatus(state, text) {
  state.refs.status.textContent = text;
}

function inferExtensionFromMimeType(mimeType = "") {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("ogg")) return "ogg";
  return "";
}

function inferMimeTypeFromExtension(extension = "") {
  const normalized = extension.toLowerCase();
  if (normalized === "mp3") return "audio/mpeg";
  if (normalized === "wav") return "audio/wav";
  if (normalized === "m4a") return "audio/mp4";
  if (normalized === "aac") return "audio/aac";
  if (normalized === "ogg") return "audio/ogg";
  if (normalized === "flac") return "audio/flac";
  if (normalized === "webm") return "audio/webm";
  if (normalized === "mp4") return "audio/mp4";
  return "";
}

function getExtensionFromName(fileName = "") {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0) return "";
  return fileName.slice(lastDot + 1).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getFileStem(fileName = "") {
  const base = fileName.split("/").pop() || fileName;
  return base.replace(/\.[^.]+$/, "");
}

function sanitizeFilePart(text, fallbackText) {
  const cleaned = text
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || fallbackText;
}

function isAudioLikeFileName(fileName = "") {
  return /\.(mp3|wav|m4a|aac|ogg|flac|webm|mp4)$/i.test(fileName);
}

function parsePadFileName(fileName = "") {
  const baseName = fileName.split("/").pop() || fileName;
  const match = baseName.match(/^(\d+)_\((.+)\)\.([^.]+)$/i);

  if (!match) {
    return {
      padNumber: null,
      padName: "",
      extension: getExtensionFromName(baseName),
      baseName,
    };
  }

  return {
    padNumber: Number(match[1]),
    padName: match[2],
    extension: match[3].toLowerCase(),
    baseName,
  };
}

function getRecommendedPadCount(required) {
  const options = [4, 8, 12, 16, 24, 32];
  const exact = options.find((value) => value >= required);
  return exact || 32;
}

function getSupportedMimeType() {
  if (!window.MediaRecorder?.isTypeSupported) return "";

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function buildRecordingLabel(blobType) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const extension = inferExtensionFromMimeType(blobType) || "webm";
  return `recording-${stamp}.${extension}`;
}

function buildZipEntryName(order, state) {
  const orderText = String(order).padStart(2, "0");
  const safeName = sanitizeFilePart(getDisplayName(state), `Pad${state.id}`);
  const extension =
    state.sourceExtension ||
    inferExtensionFromMimeType(state.sourceBlob?.type) ||
    "webm";

  return `${orderText}_(${safeName}).${extension}`;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function assignAudio(state, audioSource, label, options = {}) {
  if (!audioSource) return;

  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
  }

  resetAudio(state);

  state.objectUrl = URL.createObjectURL(audioSource);
  state.audio = new Audio(state.objectUrl);
  state.audio.preload = "auto";
  state.audio.loop = state.refs.loopInput.checked;
  state.sourceBlob = audioSource instanceof Blob ? audioSource : null;
  state.sourceKind = options.kind || "file";
  state.sourceExtension =
    (options.extension ||
      getExtensionFromName(label) ||
      inferExtensionFromMimeType(audioSource.type) ||
      "bin").toLowerCase();

  state.audio.addEventListener("ended", () => {
    updatePadVisual(state);
  });

  state.audio.addEventListener("error", () => {
    setStatus(state, "音源の読み込みに失敗しました");
  });

  setStatus(state, `設定: ${label}`);
  updatePadVisual(state);
}

function setPadName(state, name) {
  const fallback = `Pad ${state.id}`;
  const displayName = (name || "").trim() || fallback;
  state.name = displayName;
  state.refs.nameInput.value = displayName;
  updatePadVisual(state);
}

function normalizeImportedBlob(blob, extension) {
  if (blob.type && blob.type !== "application/octet-stream") {
    return blob;
  }

  const mimeType = inferMimeTypeFromExtension(extension);
  if (!mimeType) return blob;
  return new Blob([blob], { type: mimeType });
}

function ensurePadSlots(requiredPadCount) {
  if (requiredPadCount <= padStates.length) return;

  const nextCount = getRecommendedPadCount(requiredPadCount);
  if (nextCount <= padStates.length) return;

  padCount = nextCount;
  padCountSelect.value = String(nextCount);
  renderPads(nextCount);
}

function assignImportedItems(items) {
  if (activeRecordingState) {
    window.alert("録音中は読み込みできません。録音を停止してから実行してください。");
    return;
  }

  if (!items.length) {
    window.alert("読み込める音声ファイルがありませんでした。");
    return;
  }

  const requiredByPadNo = items.reduce((max, item) => {
    return Math.max(max, item.padNumber || 0);
  }, 0);
  const requiredByCount = Math.min(items.length, 32);
  const required = Math.min(32, Math.max(requiredByPadNo, requiredByCount));

  ensurePadSlots(required);

  const assignedPadIds = new Set();
  const pending = [];
  let overflowCount = 0;
  let assignedCount = 0;

  items.forEach((item) => {
    if (item.padNumber) {
      if (item.padNumber >= 1 && item.padNumber <= padStates.length) {
        const state = padStates[item.padNumber - 1];
        const padName = item.padName || getFileStem(item.fileName);
        setPadName(state, padName);
        assignAudio(state, item.blob, item.fileName, {
          kind: item.kind,
          extension: item.extension,
        });
        assignedPadIds.add(state.id);
        assignedCount += 1;
        return;
      }

      overflowCount += 1;
      return;
    }

    pending.push(item);
  });

  let cursor = 0;

  pending.forEach((item) => {
    while (cursor < padStates.length && assignedPadIds.has(padStates[cursor].id)) {
      cursor += 1;
    }

    if (cursor >= padStates.length) {
      overflowCount += 1;
      return;
    }

    const state = padStates[cursor];
    const padName = item.padName || getFileStem(item.fileName);
    setPadName(state, padName);
    assignAudio(state, item.blob, item.fileName, {
      kind: item.kind,
      extension: item.extension,
    });
    assignedPadIds.add(state.id);
    assignedCount += 1;
    cursor += 1;
  });

  if (overflowCount > 0) {
    window.alert(`上限32パッドのため ${overflowCount} 件は読み込みできませんでした。`);
  }

  if (assignedCount > 0 && padStates[0]) {
    setStatus(padStates[0], `${assignedCount}件の音源を読み込みました`);
  }
}

async function importFromZipFile(zipFile) {
  if (!canExportZip()) {
    window.alert("ZIPライブラリの読み込みに失敗しました。ページを再読み込みしてください。");
    return;
  }

  const zip = await JSZip.loadAsync(zipFile);
  const entries = Object.values(zip.files)
    .filter((entry) => !entry.dir && isAudioLikeFileName(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  const items = await Promise.all(
    entries.map(async (entry) => {
      const parsed = parsePadFileName(entry.name);
      const extension = parsed.extension || getExtensionFromName(parsed.baseName) || "webm";
      const rawBlob = await entry.async("blob");
      const blob = normalizeImportedBlob(rawBlob, extension);

      return {
        fileName: parsed.baseName,
        blob,
        padNumber: parsed.padNumber,
        padName: parsed.padName,
        extension,
        kind: "recording",
      };
    }),
  );

  assignImportedItems(items);
}

async function importFromFolder(fileList) {
  const items = Array.from(fileList)
    .filter((file) => file.type.startsWith("audio/") || isAudioLikeFileName(file.name))
    .map((file) => {
      const parsed = parsePadFileName(file.name);
      const extension =
        parsed.extension ||
        getExtensionFromName(file.name) ||
        inferExtensionFromMimeType(file.type) ||
        "webm";

      return {
        fileName: parsed.baseName,
        blob: file,
        padNumber: parsed.padNumber,
        padName: parsed.padName,
        extension,
        kind: "recording",
      };
    })
    .sort((a, b) => a.fileName.localeCompare(b.fileName, "ja"));

  assignImportedItems(items);
}

async function togglePlayback(state) {
  if (!state.audio) {
    setStatus(state, "先に音源を割り当ててください");
    return;
  }

  if (!state.audio.paused) {
    resetAudio(state);
    updatePadVisual(state);
    return;
  }

  try {
    await state.audio.play();
    updatePadVisual(state);
  } catch (_error) {
    setStatus(state, "再生できませんでした（端末の再生制限の可能性）");
  }
}

async function exportRecordedPads() {
  if (!canExportZip()) {
    window.alert("ZIPライブラリの読み込みに失敗しました。ページを再読み込みしてください。");
    return;
  }

  if (activeRecordingState) {
    window.alert("録音中は保存できません。録音を停止してから実行してください。");
    return;
  }

  const targets = padStates.filter(
    (state) => state.sourceKind === "recording" && state.sourceBlob,
  );

  if (!targets.length) {
    window.alert("保存できる録音がありません。先に録音してください。");
    return;
  }

  saveRecordingsButton.disabled = true;

  try {
    const zip = new JSZip();
    const sortedTargets = [...targets].sort((a, b) => a.id - b.id);

    sortedTargets.forEach((state, index) => {
      zip.file(buildZipEntryName(index + 1, state), state.sourceBlob);
    });

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadBlob(zipBlob, `pad-recordings-${stamp}.zip`);
    setStatus(sortedTargets[0], `${sortedTargets.length}件の録音を書き出しました`);
  } catch (_error) {
    window.alert("録音の書き出しに失敗しました。");
  } finally {
    saveRecordingsButton.disabled = false;
  }
}

function cleanupRecordingState(state) {
  state.mediaRecorder = null;
  state.recordedChunks = [];
  state.isRecording = false;

  if (activeRecordingState === state) {
    activeRecordingState = null;
  }
}

function updateRecordButton(state) {
  const button = state.refs.recordButton;

  if (!canRecordAudio()) {
    button.disabled = true;
    button.classList.remove("recording");
    button.textContent = "録音非対応";
    return;
  }

  if (isMicConnecting) {
    button.disabled = true;
    button.classList.remove("recording");
    button.textContent = "マイク接続中";
    return;
  }

  if (state.isRecording) {
    button.disabled = false;
    button.classList.add("recording");
    button.textContent = "録音停止";
    return;
  }

  button.classList.remove("recording");

  if (activeRecordingState && activeRecordingState !== state) {
    button.disabled = true;
    button.textContent = "他を録音中";
    return;
  }

  button.disabled = false;
  button.textContent = "録音開始";
}

function refreshRecordButtons() {
  padStates.forEach((state) => updateRecordButton(state));
}

function finalizeRecording(state) {
  const chunks = state.recordedChunks || [];
  const blobType =
    chunks[0]?.type || state.mediaRecorder?.mimeType || "audio/webm";

  if (!chunks.length) {
    cleanupRecordingState(state);
    refreshRecordButtons();
    setStatus(state, "録音データが取得できませんでした");
    return;
  }

  const blob = new Blob(chunks, { type: blobType });
  const extension = inferExtensionFromMimeType(blobType) || "webm";
  const label = buildRecordingLabel(blobType);

  cleanupRecordingState(state);
  refreshRecordButtons();
  assignAudio(state, blob, label, { kind: "recording", extension });
}

async function startRecording(state) {
  if (!canRecordAudio()) {
    setStatus(state, "このブラウザは録音に対応していません");
    return;
  }

  if (activeRecordingState && activeRecordingState !== state) {
    setStatus(state, "他のパッドを録音中です");
    return;
  }

  try {
    const stream = await ensureMicStream();
    const mimeType = getSupportedMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    state.mediaRecorder = recorder;
    state.recordedChunks = [];
    state.isRecording = true;
    activeRecordingState = state;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        state.recordedChunks.push(event.data);
      }
    };

    recorder.onerror = () => {
      cleanupRecordingState(state);
      refreshRecordButtons();
      setStatus(state, "録音エラーが発生しました");
    };

    recorder.onstop = () => {
      finalizeRecording(state);
    };

    recorder.start();
    refreshRecordButtons();
    setStatus(state, "録音中... もう一度押すと停止");
  } catch (_error) {
    setStatus(state, "マイク許可または録音初期化に失敗しました");
  }
}

function stopRecording(state) {
  if (!state.mediaRecorder) return;

  if (state.mediaRecorder.state !== "inactive") {
    state.mediaRecorder.stop();
    return;
  }

  finalizeRecording(state);
}

function cancelRecording(state) {
  if (!state.mediaRecorder) {
    cleanupRecordingState(state);
    return;
  }

  state.mediaRecorder.ondataavailable = null;
  state.mediaRecorder.onerror = null;
  state.mediaRecorder.onstop = null;

  if (state.mediaRecorder.state !== "inactive") {
    state.mediaRecorder.stop();
  }

  cleanupRecordingState(state);
  refreshRecordButtons();
}

function toggleRecording(state) {
  if (state.isRecording) {
    stopRecording(state);
    return;
  }

  startRecording(state);
}

function createPad(id) {
  const node = padTemplate.content.firstElementChild.cloneNode(true);
  const padButton = node.querySelector(".pad-button");
  const nameInput = node.querySelector(".name-input");
  const fileInput = node.querySelector(".file-input");
  const recordButton = node.querySelector(".record-button");
  const loopInput = node.querySelector(".loop-input");
  const status = node.querySelector(".status");

  const state = {
    id,
    name: `Pad ${id}`,
    audio: null,
    objectUrl: "",
    sourceBlob: null,
    sourceKind: "none",
    sourceExtension: "",
    mediaRecorder: null,
    recordedChunks: [],
    isRecording: false,
    refs: { padButton, nameInput, fileInput, recordButton, loopInput, status },
  };

  nameInput.value = state.name;
  updatePadVisual(state);
  updateRecordButton(state);

  nameInput.addEventListener("input", () => {
    state.name = nameInput.value;
    updatePadVisual(state);
  });

  fileInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    assignAudio(state, file, file.name, {
      kind: "file",
      extension: getExtensionFromName(file.name) || inferExtensionFromMimeType(file.type) || "bin",
    });
  });

  recordButton.addEventListener("click", () => {
    toggleRecording(state);
  });

  loopInput.addEventListener("change", () => {
    if (state.audio) state.audio.loop = loopInput.checked;
  });

  padButton.addEventListener("click", () => {
    togglePlayback(state);
  });

  padStates.push(state);
  return node;
}

function clearPads() {
  padStates.forEach((state) => {
    cancelRecording(state);
    resetAudio(state);
    if (state.objectUrl) {
      URL.revokeObjectURL(state.objectUrl);
    }
  });

  activeRecordingState = null;
  padStates.length = 0;
  grid.innerHTML = "";
}

function renderPads(count) {
  clearPads();
  const fragment = document.createDocumentFragment();
  for (let i = 1; i <= count; i += 1) {
    fragment.appendChild(createPad(i));
  }
  grid.appendChild(fragment);
}

function stopAll() {
  padStates.forEach((state) => {
    resetAudio(state);
    updatePadVisual(state);
  });
}

padCountSelect.addEventListener("change", () => {
  padCount = Number(padCountSelect.value);
  renderPads(padCount);
});

stopAllButton.addEventListener("click", stopAll);
saveRecordingsButton.addEventListener("click", exportRecordedPads);
micToggleButton.addEventListener("click", toggleMicConnection);
loadZipButton.addEventListener("click", () => {
  zipInput.click();
});
loadFolderButton.addEventListener("click", () => {
  folderInput.click();
});

zipInput.addEventListener("change", async (event) => {
  const zipFile = event.target.files?.[0];
  event.target.value = "";
  if (!zipFile) return;

  loadZipButton.disabled = true;
  loadFolderButton.disabled = true;

  try {
    await importFromZipFile(zipFile);
  } catch (_error) {
    window.alert("ZIP読み込みに失敗しました。ZIP形式を確認してください。");
  } finally {
    loadZipButton.disabled = false;
    loadFolderButton.disabled = false;
  }
});

folderInput.addEventListener("change", async (event) => {
  const files = event.target.files;
  event.target.value = "";
  if (!files?.length) return;

  loadZipButton.disabled = true;
  loadFolderButton.disabled = true;

  try {
    await importFromFolder(files);
  } catch (_error) {
    window.alert("フォルダ読み込みに失敗しました。");
  } finally {
    loadZipButton.disabled = false;
    loadFolderButton.disabled = false;
  }
});

window.addEventListener("beforeunload", () => {
  clearPads();
  disconnectMicStream();
});

updateMicToggleButton();
renderPads(padCount);
