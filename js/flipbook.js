const cfg = window.FLIPBOOK_CONFIG || {};
const $ = (id) => document.getElementById(id);

const statusEl = $("status");
const bookEl = $("book");

// Pages rendered ahead of/behind the current spread.
const PRELOAD_RADIUS = 3;

function showStatus(html) {
  statusEl.innerHTML = html;
  statusEl.hidden = false;
}

/**
 * A source exposes: count, aspect (height / width), and render(index, pageEl).
 */
async function loadImageSource(manifestUrl) {
  const res = await fetch(manifestUrl, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Cannot load ${manifestUrl} (HTTP ${res.status})`);
  const manifest = await res.json();
  const base = new URL(manifestUrl, location.href);
  const urls = manifest.pages.map((p) => new URL(p, base).href);
  const labels = manifest.labels;

  return {
    count: urls.length,
    aspect: manifest.height / manifest.width,
    labels,
    render(index, pageEl) {
      const img = new Image();
      img.decoding = "async";
      img.alt = labels ? labels[index] : `Page ${index + 1}`;
      img.src = urls[index];
      return img.decode().catch(() => {}).then(() => pageEl.replaceChildren(img));
    },
  };
}

async function loadPdfSource(pdfUrl) {
  const pdfjs = await import("../vendor/pdfjs/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;

  const doc = await pdfjs.getDocument({ url: new URL(pdfUrl, location.href).href }).promise;
  const first = await doc.getPage(1);
  const vp = first.getViewport({ scale: 1 });
  const scale = cfg.renderScale || 2;

  return {
    count: doc.numPages,
    aspect: vp.height / vp.width,
    async render(index, pageEl) {
      const page = await doc.getPage(index + 1);
      const viewport = page.getViewport({ scale: Math.min(scale, 2400 / page.getViewport({ scale: 1 }).width) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport }).promise;
      pageEl.replaceChildren(canvas);
    },
  };
}

function buildPages(count) {
  const pages = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = "page page--loading";
    if (cfg.hardCovers && (i === 0 || i === count - 1)) el.dataset.density = "hard";
    bookEl.appendChild(el);
    pages.push(el);
  }
  return pages;
}

function pageFromHash(count) {
  const m = location.hash.match(/page=(\d+)/);
  const n = m ? parseInt(m[1], 10) : 1;
  return Math.min(Math.max(n, 1), count) - 1;
}

function setupToolbar(flip, count, labels, beforeTurn = () => {}) {
  const cur = $("page-current");
  // With printed labels (Cover, 1…28, Back cover) the total is the last numbered page.
  const numbered = labels ? labels.filter((l) => /^\d+$/.test(l)) : [];
  $("page-total").textContent = numbered.length ? numbered[numbered.length - 1] : count;
  const name = (i) => (labels ? labels[i] : `${i + 1}`);

  const update = (index) => {
    const portrait = flip.getOrientation() === "portrait";
    // In landscape the cover is shown alone, then spreads of two.
    const label = !portrait && index > 0 && index < count - 1
      ? `${name(index)} – ${name(Math.min(index + 1, count - 1))}`
      : name(index);
    cur.textContent = label;
    $("btn-first").disabled = $("btn-prev").disabled = index === 0;
    $("btn-last").disabled = $("btn-next").disabled = index >= count - (portrait ? 1 : 2);
    history.replaceState(null, "", `#page=${index + 1}`);
  };

  // Destination of a one-step turn: spreads advance by 2 in landscape, 1 in portrait.
  const step = () => (flip.getOrientation() === "portrait" ? 1 : 2);
  const clamp = (i) => Math.min(Math.max(i, 0), count - 1);
  const go = {
    first: () => { beforeTurn(0); flip.flip(0); },
    prev: () => { const i = flip.getCurrentPageIndex(); beforeTurn(i <= step() ? 0 : clamp(i - step())); flip.flipPrev(); },
    next: () => { const i = flip.getCurrentPageIndex(); beforeTurn(i === 0 ? 1 : clamp(i + step())); flip.flipNext(); },
    last: () => { beforeTurn(count - 1); flip.flip(count - 1); },
  };
  $("btn-first").onclick = go.first;
  $("btn-prev").onclick = go.prev;
  $("btn-next").onclick = go.next;
  $("btn-last").onclick = go.last;

  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea")) return;
    if (e.key === "ArrowLeft" || e.key === "PageUp") go.prev();
    else if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); go.next(); }
    else if (e.key === "Home") go.first();
    else if (e.key === "End") go.last();
  });

  const fsBtn = $("btn-fullscreen");
  if (document.fullscreenEnabled) {
    fsBtn.onclick = () => document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
  } else {
    fsBtn.hidden = true;
  }

  const dl = $("btn-download");
  if (cfg.allowDownload && cfg.pdf) {
    dl.href = cfg.pdf;
    if (cfg.downloadName) dl.download = cfg.downloadName;
    dl.hidden = false;
  }

  return update;
}

async function init() {
  if (cfg.title) {
    document.title = cfg.title;
    $("book-title").textContent = cfg.title;
  }

  let source;
  try {
    if (cfg.imagesManifest) {
      try {
        source = await loadImageSource(cfg.imagesManifest);
      } catch (err) {
        if (!cfg.pdf) throw err;
        console.warn(`${err.message} — falling back to ${cfg.pdf}`);
      }
    }
    source ??= await loadPdfSource(cfg.pdf);
  } catch (err) {
    console.error(err);
    showStatus(`Could not load the flipbook.<br><small>${err.message}</small><br><br>
      Check that <code>${cfg.imagesManifest || cfg.pdf}</code> exists and that the page is served over HTTP
      (opening <code>index.html</code> directly from disk will not work).`);
    return;
  }

  const pages = buildPages(source.count);
  const rendered = new Map();
  const ensure = (i) => {
    if (i < 0 || i >= source.count || rendered.has(i)) return;
    const p = source.render(i, pages[i])
      .then(() => pages[i].classList.remove("page--loading"))
      .catch((err) => { console.error(`Page ${i + 1}:`, err); rendered.delete(i); });
    rendered.set(i, p);
  };
  const preload = (center) => {
    for (let d = 0; d <= PRELOAD_RADIUS; d++) { ensure(center + d); ensure(center - d); }
  };

  const baseWidth = 600;
  const startPage = pageFromHash(source.count);
  preload(startPage);

  statusEl.hidden = true;
  bookEl.hidden = false;

  const flip = new St.PageFlip(bookEl, {
    width: baseWidth,
    height: Math.round(baseWidth * source.aspect),
    size: "stretch",
    minWidth: 200,
    maxWidth: 2000,
    minHeight: Math.round(200 * source.aspect),
    maxHeight: Math.round(2000 * source.aspect),
    showCover: true,
    usePortrait: true,
    maxShadowOpacity: 0.5,
    mobileScrollSupport: false,
    startPage,
  });
  flip.loadFromHTML(pages);

  const center = setupCentering(flip, source.count);
  const update = setupToolbar(flip, source.count, source.labels, center.before);
  update(flip.getCurrentPageIndex());
  flip.on("flip", (e) => { update(e.data); preload(e.data); center.to(e.data); });
  flip.on("changeOrientation", () => { update(flip.getCurrentPageIndex()); center.to(flip.getCurrentPageIndex(), false); });
}

/**
 * In spread view a closed book (front or back cover alone) occupies one half of the spread slot,
 * leaving the other half empty. Slide it half a page so the cover sits centred, and slide back as
 * the book opens. Pointer mapping stays correct: StPageFlip reads the block's client rect.
 */
function setupCentering(flip, count) {
  const stage = $("stage");
  const shiftFor = (index) => {
    if (flip.getOrientation() !== "landscape") return 0;
    const half = flip.getBoundsRect().pageWidth / 2;
    if (index === 0) return -half;
    if (index === count - 1 && count % 2 === 0) return half;
    return 0;
  };
  const set = (px, animate = true) => {
    stage.classList.toggle("is-shifting", animate);
    stage.style.setProperty("--book-shift", `${px}px`);
  };
  const to = (index, animate = true) => set(shiftFor(index), animate);

  // Opening a cover by drag/click: start sliding as soon as the page starts to move.
  flip.on("changeState", (e) => {
    if (e.data !== "user_fold" && e.data !== "flipping") return;
    const i = flip.getCurrentPageIndex();
    if (i === 0 || i === count - 1) set(0);
  });
  // Layout can change without a window resize (web font swap, fullscreen), so watch the stage.
  // rAF: let StPageFlip apply its own resize first so pageWidth is current.
  new ResizeObserver(() => requestAnimationFrame(() => to(flip.getCurrentPageIndex(), false))).observe(stage);
  to(flip.getCurrentPageIndex(), false);

  // Toolbar/keyboard know the destination up front, so closing the book slides in step with the flip.
  return { to, before: (target) => to(target) };
}

init();
