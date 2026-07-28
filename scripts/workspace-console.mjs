/* eslint-disable no-console, n/no-process-exit */
// Workspace Console renderer.
//
// The Workspace Console artifact is a *render* of a persistent task index, not a
// place tasks are appended to one at a time. The index (workspace/.console-index.json)
// is the source of truth; this script turns it into a self-contained tabbed HTML page
// (workspace/.console.html) that the /workspace-console skill publishes as an Artifact.
//
// Both files live under workspace/ and are gitignored (workspace/* ignore rule) — the
// index accumulates locally and survives finalizer cleanup of ephemeral task folders.
//
// Usage:
//   node scripts/workspace-console.mjs init     # create an empty index (keeps existing)
//   node scripts/workspace-console.mjs render    # index -> workspace/.console.html
//   node scripts/workspace-console.mjs           # same as render
//
// The canonical artifact URL lives in the index (`artifactUrl`); `init` seeds it with
// DEFAULT_ARTIFACT_URL so a fresh machine updates the same artifact in place.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const DEFAULT_ARTIFACT_URL = 'https://claude.ai/code/artifact/6425695a-b0e4-4719-8cf8-9ff31fc2c2e6';
const INDEX_PATH = resolve('workspace/.console-index.json');
const OUT_PATH = resolve('workspace/.console.html');

/** @typedef {{id:string,title:string,status:string,source?:string,summary?:string,keyPoints?:string[],changeMapMermaid?:string,updatedAt?:string}} Task */

const STATUS = {
	done: { cls: 'done', label: 'Done' },
	'in-progress': { cls: 'active', label: 'In progress' },
	pending: { cls: 'pending', label: 'Pending' },
	deferred: { cls: 'defer', label: 'Deferred' },
	reference: { cls: 'info', label: 'Reference' },
};
const statusInfo = (s) => STATUS[s] || { cls: 'defer', label: s || 'Unknown' };

const esc = (v) =>
	String(v ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

// Mermaid source must keep its `>` arrows; only neutralize the HTML-breaking chars.
const escMermaid = (v) =>
	String(v ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;');

function loadIndex() {
	if (!existsSync(INDEX_PATH)) {
		throw new Error(`No index at ${INDEX_PATH}. Run "node scripts/workspace-console.mjs init" first.`);
	}
	const idx = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
	idx.tasks = Array.isArray(idx.tasks) ? idx.tasks : [];
	idx.artifactUrl = idx.artifactUrl || DEFAULT_ARTIFACT_URL;
	return idx;
}

function init() {
	mkdirSync(dirname(INDEX_PATH), { recursive: true });
	const seed = { artifactUrl: DEFAULT_ARTIFACT_URL, updatedAt: new Date().toISOString(), tasks: [] };
	try {
		writeFileSync(INDEX_PATH, JSON.stringify(seed, null, 2) + '\n', { flag: 'wx' });
		console.log(`Created ${INDEX_PATH}`);
	} catch (err) {
		if (err.code === 'EEXIST') {
			console.log(`Index already exists at ${INDEX_PATH} — left untouched.`);
			return;
		}
		throw err;
	}
}

function renderKeyPoints(points) {
	if (!Array.isArray(points) || points.length === 0) return '';
	return `<ul class="keys">${points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`;
}

function renderChangeMap(mermaid) {
	if (!mermaid) return '';
	return `<div class="diagram"><pre class="mermaid">\n${escMermaid(mermaid)}\n</pre></div>`;
}

function renderTaskPanel(task, i) {
	const st = statusInfo(task.status);
	const meta = [
		`<span class="chip ${st.cls}">${esc(st.label).toUpperCase()}</span>`,
		task.source ? `<span class="chip file">${esc(task.source)}</span>` : '',
	].join('');
	return `  <section class="panel${i === 0 ? ' active' : ''}" role="tabpanel" id="p-${i}" aria-labelledby="t-${i}"${i === 0 ? '' : ' hidden'}>
    <div class="card">
      <h2>${esc(task.title || task.id)}</h2>
      <div class="metaline">${meta}</div>
      ${task.summary ? `<p class="lede">${esc(task.summary)}</p>` : ''}
      ${renderChangeMap(task.changeMapMermaid)}
      ${renderKeyPoints(task.keyPoints)}
    </div>
  </section>`;
}

function renderTab(task, i) {
	const st = statusInfo(task.status);
	return `    <button class="tab" role="tab" aria-selected="${i === 0}" aria-controls="p-${i}" id="t-${i}"${i === 0 ? '' : ' tabindex="-1"'}><span class="dot ${st.cls}"></span>${esc(task.title || task.id)}</button>`;
}

function renderOverview(tasks) {
	const rows = tasks
		.map((t) => {
			const st = statusInfo(t.status);
			return `<li><span class="chip ${st.cls}">${esc(st.label)}</span><span>${esc(t.title || t.id)}${t.summary ? ` — <span class="ov-sum">${esc(t.summary)}</span>` : ''}</span></li>`;
		})
		.join('');
	return `<ul class="overview">${rows || '<li><span>No tasks in the index yet.</span></li>'}</ul>`;
}

function render() {
	const idx = loadIndex();
	const tasks = idx.tasks;
	const counts = { done: 0, pending: 0, deferred: 0 };
	for (const t of tasks) {
		if (t.status === 'done') counts.done++;
		else if (t.status === 'pending' || t.status === 'in-progress') counts.pending++;
		else counts.deferred++;
	}

	// Overview is tab 0; tasks follow.
	const tabs = [
		`    <button class="tab" role="tab" aria-selected="true" aria-controls="p-0" id="t-0"><span class="dot"></span>Overview</button>`,
		...tasks.map((t, i) => renderTab(t, i + 1)),
	].join('\n');

	const panels = [
		`  <section class="panel active" role="tabpanel" id="p-0" aria-labelledby="t-0">
    <div class="card">
      <h2>Workspace overview</h2>
      <p>${tasks.length} task${tasks.length === 1 ? '' : 's'} tracked in the local index. Each has its own tab.</p>
      ${renderOverview(tasks)}
    </div>
  </section>`,
		...tasks.map((t, i) => renderTaskPanel(t, i + 1)),
	].join('\n');

	const updated = idx.updatedAt ? new Date(idx.updatedAt) : new Date();
	const updatedStr = updated.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

	const html = `<title>Workspace Console — Roborock Plugin</title>
<style>
  :root {
    --bg:#eef1f5; --surface:#fff; --surface-2:#f6f8fb; --ink:#16202b; --ink-soft:#33404e; --muted:#5c6b7a;
    --border:#dbe2ea; --accent:#0b8f94; --done-fg:#1a7d4b; --done-bg:#e0f2e6; --active-fg:#0b6d71; --active-bg:#d7efef;
    --pending-fg:#a9640a; --pending-bg:#f7ebd6; --defer-fg:#5a6b7c; --defer-bg:#e7edf3; --info-fg:#2f6fb0; --info-bg:#e2edf8;
    --shadow:0 1px 2px rgba(20,32,43,.06),0 8px 24px rgba(20,32,43,.06);
    --mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;
    --sans:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  }
  @media (prefers-color-scheme:dark){:root{
    --bg:#0c1219; --surface:#141d28; --surface-2:#101823; --ink:#e7eef5; --ink-soft:#c2cedb; --muted:#8394a4;
    --border:#223041; --accent:#2bd4d9; --done-fg:#48d38c; --done-bg:#123528; --active-fg:#2bd4d9; --active-bg:#123138;
    --pending-fg:#e6ab48; --pending-bg:#382a13; --defer-fg:#93a3b4; --defer-bg:#1c2833; --info-fg:#6db0ec; --info-bg:#14293c;
    --shadow:0 1px 2px rgba(0,0,0,.3),0 10px 30px rgba(0,0,0,.35);
  }}
  :root[data-theme="light"]{
    --bg:#eef1f5; --surface:#fff; --surface-2:#f6f8fb; --ink:#16202b; --ink-soft:#33404e; --muted:#5c6b7a;
    --border:#dbe2ea; --accent:#0b8f94; --done-fg:#1a7d4b; --done-bg:#e0f2e6; --active-fg:#0b6d71; --active-bg:#d7efef;
    --pending-fg:#a9640a; --pending-bg:#f7ebd6; --defer-fg:#5a6b7c; --defer-bg:#e7edf3; --info-fg:#2f6fb0; --info-bg:#e2edf8;
    --shadow:0 1px 2px rgba(20,32,43,.06),0 8px 24px rgba(20,32,43,.06);
  }
  :root[data-theme="dark"]{
    --bg:#0c1219; --surface:#141d28; --surface-2:#101823; --ink:#e7eef5; --ink-soft:#c2cedb; --muted:#8394a4;
    --border:#223041; --accent:#2bd4d9; --done-fg:#48d38c; --done-bg:#123528; --active-fg:#2bd4d9; --active-bg:#123138;
    --pending-fg:#e6ab48; --pending-bg:#382a13; --defer-fg:#93a3b4; --defer-bg:#1c2833; --info-fg:#6db0ec; --info-bg:#14293c;
    --shadow:0 1px 2px rgba(0,0,0,.3),0 10px 30px rgba(0,0,0,.35);
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.55;-webkit-font-smoothing:antialiased}
  .wrap{max-width:1020px;margin:0 auto;padding:30px 20px 64px}
  .eyebrow{font-family:var(--mono);font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);font-weight:600}
  h1{font-size:clamp(21px,3.2vw,28px);line-height:1.15;margin:6px 0 0;letter-spacing:-.02em;text-wrap:balance}
  .sub{color:var(--muted);font-size:13px;margin:6px 0 0;font-family:var(--mono)}
  .stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:24px 0 20px}
  .stat{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:3px}
  .stat .n{font-family:var(--mono);font-size:26px;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
  .stat .l{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
  .stat.done .n{color:var(--done-fg)} .stat.pending .n{color:var(--pending-fg)} .stat.defer .n{color:var(--defer-fg)} .stat.total .n{color:var(--accent)}
  .tabbar{display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:22px;overflow-x:auto;scrollbar-width:thin;position:sticky;top:0;background:var(--bg);z-index:5;padding-top:4px}
  .tab{appearance:none;border:0;background:transparent;color:var(--muted);cursor:pointer;font-family:var(--sans);font-size:13.5px;font-weight:550;padding:11px 15px 13px;white-space:nowrap;border-bottom:2px solid transparent;margin-bottom:-1px;border-radius:8px 8px 0 0;transition:color .15s,background .15s;display:inline-flex;align-items:center;gap:8px}
  .tab:hover{color:var(--ink-soft);background:var(--surface-2)}
  .tab[aria-selected="true"]{color:var(--accent);border-bottom-color:var(--accent)}
  .tab:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .tab .dot{width:7px;height:7px;border-radius:50%;background:var(--muted)}
  .tab .dot.done{background:var(--done-fg)} .tab .dot.pending{background:var(--pending-fg)} .tab .dot.active{background:var(--active-fg)} .tab .dot.defer{background:var(--defer-fg)} .tab .dot.info{background:var(--info-fg)}
  .panel{display:none;animation:fade .22s ease}
  .panel.active{display:block}
  @keyframes fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
  @media (prefers-reduced-motion:reduce){.panel{animation:none}}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px 24px;box-shadow:var(--shadow)}
  .card h2{margin:0 0 6px;font-size:18px;letter-spacing:-.015em;text-wrap:balance}
  .card p{margin:10px 0;color:var(--ink-soft);font-size:14.5px}
  .card p.lede{color:var(--ink);font-size:15.5px}
  .metaline{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center;margin:8px 0 2px}
  .chip{font-family:var(--mono);font-size:11.5px;font-weight:600;letter-spacing:.02em;padding:3px 9px;border-radius:999px;border:1px solid transparent;white-space:nowrap}
  .chip.done{color:var(--done-fg);background:var(--done-bg)} .chip.active{color:var(--active-fg);background:var(--active-bg)} .chip.pending{color:var(--pending-fg);background:var(--pending-bg)} .chip.defer{color:var(--defer-fg);background:var(--defer-bg)} .chip.info{color:var(--info-fg);background:var(--info-bg)}
  .chip.file{color:var(--muted);background:var(--surface-2);border-color:var(--border)}
  ul.keys{margin:8px 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}
  ul.keys li{position:relative;padding-left:20px;font-size:14.5px;color:var(--ink-soft)}
  ul.keys li::before{content:"";position:absolute;left:3px;top:9px;width:6px;height:6px;border-radius:2px;background:var(--accent)}
  ul.overview{margin:10px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}
  ul.overview li{display:flex;gap:11px;align-items:baseline;padding:9px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:9px;font-size:14px}
  ul.overview .ov-sum{color:var(--muted)}
  .diagram{background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:14px;margin:12px 0;overflow-x:auto}
  .diagram pre.mermaid{margin:0;text-align:center}
  footer{margin-top:26px;padding-top:14px;border-top:1px solid var(--border);color:var(--muted);font-size:12.5px;display:flex;flex-wrap:wrap;gap:6px 14px;justify-content:space-between}
  @media (max-width:640px){.stats{grid-template-columns:repeat(2,1fr)}.card{padding:18px 16px}}
</style>

<div class="wrap">
  <header>
    <span class="eyebrow">Workspace Console</span>
    <h1>Matterbridge · Roborock Vacuum Plugin</h1>
    <p class="sub">Rendered from the local task index · updated ${esc(updatedStr)}</p>
  </header>

  <section class="stats" aria-label="Workspace summary">
    <div class="stat total"><span class="n">${tasks.length}</span><span class="l">Tasks</span></div>
    <div class="stat done"><span class="n">${counts.done}</span><span class="l">Done</span></div>
    <div class="stat pending"><span class="n">${counts.pending}</span><span class="l">Active / Pending</span></div>
    <div class="stat defer"><span class="n">${counts.deferred}</span><span class="l">Deferred / Ref</span></div>
  </section>

  <div class="tabbar" role="tablist" aria-label="Workspace tasks">
${tabs}
  </div>

${panels}

  <footer>
    <span>Generated from <code>workspace/</code> — snapshot, private by default.</span>
    <span>${counts.done} done · ${counts.pending} active/pending · ${counts.deferred} deferred</span>
  </footer>
</div>

<script>
  (function () {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
    var panels = Array.prototype.slice.call(document.querySelectorAll('.panel'));
    function select(i) {
      tabs.forEach(function (t, j) {
        var on = i === j;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        panels[j].classList.toggle('active', on);
        if (on) { panels[j].removeAttribute('hidden'); } else { panels[j].setAttribute('hidden', ''); }
      });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i); });
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = tabs.length - 1;
        if (n !== null) { e.preventDefault(); select(n); tabs[n].focus(); }
      });
    });
  })();
</script>
`;

	writeFileSync(OUT_PATH, html);
	console.log(`Rendered ${tasks.length} task(s) -> ${OUT_PATH}`);
	console.log(`Artifact URL (publish target): ${idx.artifactUrl}`);
}

const cmd = process.argv[2] || 'render';
if (cmd === 'init') init();
else if (cmd === 'render') render();
else {
	console.error(`Unknown command "${cmd}". Use: init | render`);
	process.exit(1);
}
