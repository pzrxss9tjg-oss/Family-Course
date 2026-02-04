// Clickable cards
document.addEventListener("click", (e) => {
  const card = e.target.closest("[data-href]");
  if (!card) return;
  // allow nested buttons/inputs to work
  if (e.target.closest("button") || e.target.closest("input") || e.target.closest("label") || e.target.closest("summary")) return;
  const href = card.getAttribute("data-href");
  if (href) window.location.href = href;
});

const STORE_DONE = "df_course_done_v1";
const STORE_SCORES = "df_course_scores_v1";

function getObj(key){
  try { return JSON.parse(localStorage.getItem(key) || "{}"); }
  catch { return {}; }
}
function setObj(key, obj){
  localStorage.setItem(key, JSON.stringify(obj));
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-complete]");
  if (!btn) return;
  const key = btn.getAttribute("data-complete");
  const done = getObj(STORE_DONE);
  done[key] = !done[key];
  setObj(STORE_DONE, done);
  renderDone();
});

function renderDone(){
  const done = getObj(STORE_DONE);
  document.querySelectorAll("[data-done-badge]").forEach(el => {
    const key = el.getAttribute("data-done-badge");
    const isDone = !!done[key];
    el.textContent = isDone ? "Completed ✓" : "Not completed";
    el.classList.toggle("good", isDone);
  });

  // Landing page stats if present
  const countEl = document.querySelector("[data-progress-count]");
  const totalEl = document.querySelector("[data-progress-total]");
  if (countEl && totalEl){
    const total = parseInt(totalEl.getAttribute("data-progress-total"), 10) || 0;
    const completed = Object.values(done).filter(Boolean).length;
    countEl.textContent = String(completed);
    totalEl.textContent = String(total);
  }
}

function scoreQuiz(container){
  const scoreBox = container.querySelector("[data-quiz-result]");
  const keys = container.querySelectorAll(".anskey");
  let correct = 0;
  let total = keys.length;

  keys.forEach(k => {
    const ans = k.getAttribute("data-ans");
    const qname = k.getAttribute("data-qname");
    const selected = container.querySelector(`input[name="${qname}"]:checked`);
    const ok = selected && selected.value === ans;
    if (ok) correct += 1;
  });

  if (scoreBox){
    scoreBox.textContent = `Quiz score: ${correct}/${total}`;
    scoreBox.style.color = (correct === total) ? "var(--good)" : "var(--muted)";
  }

  // persist score if module key exists
  const moduleKey = container.getAttribute("data-module");
  if (moduleKey){
    const scores = getObj(STORE_SCORES);
    scores[moduleKey] = {correct, total, ts: Date.now()};
    setObj(STORE_SCORES, scores);

    // update any badges showing score
    document.querySelectorAll(`[data-score-badge="${moduleKey}"]`).forEach(el=>{
      el.textContent = `Quiz: ${correct}/${total}`;
    });
  }
}

document.addEventListener("click", (e)=>{
  const btn = e.target.closest("[data-quiz-check]");
  if (!btn) return;
  const wrap = btn.closest("[data-module]");
  if (!wrap) return;
  scoreQuiz(wrap);
});

function renderScores(){
  const scores = getObj(STORE_SCORES);
  Object.entries(scores).forEach(([key, val])=>{
    document.querySelectorAll(`[data-score-badge="${key}"]`).forEach(el=>{
      el.textContent = `Quiz: ${val.correct}/${val.total}`;
    });
  });
}

renderDone();
renderScores();


// Module jump dropdown (optional)
document.addEventListener("change", (e) => {
  const sel = e.target.closest("[data-module-jump]");
  if (!sel) return;
  const href = sel.value;
  if (href) window.location.href = href;
});

// Expand/collapse helpers
document.addEventListener("click", (e)=>{
  const btn = e.target.closest("[data-expand-all],[data-collapse-all]");
  if (!btn) return;
  const wrap = btn.closest("[data-accordion-scope]") || document;
  const detailsEls = wrap.querySelectorAll("details");
  const open = btn.hasAttribute("data-expand-all");
  detailsEls.forEach(d => d.open = open);
});


/* Scripture modal (loads full text on demand)
   Uses bible-api.com (public-domain KJV text). */
function ensureScriptureModal(){
  if (document.getElementById("scriptureModal")) return;
  const modal = document.createElement("div");
  modal.id = "scriptureModal";
  modal.style.cssText = "position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);padding:18px;z-index:9999;";
  modal.innerHTML = `
    <div style="max-width:900px;width:100%;background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line);background:#fafbff">
        <div>
          <div id="scriptureTitle" style="font-weight:900;color:var(--ink)"></div>
          <div id="scriptureMeta" style="font-size:12px;color:var(--muted)">KJV • loaded live</div>
        </div>
        <button class="btn" data-scripture-close type="button">Close</button>
      </div>
      <div style="padding:14px 16px;max-height:70vh;overflow:auto">
        <div id="scriptureBody" style="color:var(--ink)"></div>
        <div id="scriptureErr" style="display:none;margin-top:10px" class="notice"></div>
        <div style="margin-top:12px" class="small">
          If your class prefers a different translation, you can swap the API in <code>assets/app.js</code>.
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", (e)=>{
    if (e.target === modal) closeScripture();
  });
  document.addEventListener("click", (e)=>{
    if (e.target.closest("[data-scripture-close]")) closeScripture();
  });
}
function closeScripture(){
  const modal = document.getElementById("scriptureModal");
  if (modal) modal.style.display = "none";
}
async function openScripture(ref){
  ensureScriptureModal();
  const modal = document.getElementById("scriptureModal");
  const titleEl = document.getElementById("scriptureTitle");
  const bodyEl = document.getElementById("scriptureBody");
  const errEl = document.getElementById("scriptureErr");
  titleEl.textContent = ref;
  bodyEl.innerHTML = "<p class='small'>Loading…</p>";
  errEl.style.display = "none";
  modal.style.display = "flex";

  // bible-api accepts simple strings; encode safely
  const url = "https://bible-api.com/" + encodeURIComponent(ref) + "?translation=kjv";
  try{
    const res = await fetch(url);
    if (!res.ok) throw new Error("Unable to load text (network or API).");
    const data = await res.json();
    if (!data || !data.verses || !data.verses.length){
      throw new Error("No verses returned for this reference. Try a simpler reference format (e.g., John 3:16).");
    }
    const chunks = data.verses.map(v => {
      const vn = (v.verse !== undefined) ? `<sup style="color:var(--muted)">${v.verse}</sup>` : "";
      const text = (v.text || "").trim();
      return `<p style="margin:0 0 10px 0">${vn} ${escapeHtml(text)}</p>`;
    }).join("");
    bodyEl.innerHTML = chunks;
  }catch(err){
    bodyEl.innerHTML = "";
    errEl.style.display = "block";
    errEl.innerHTML = `<b>Couldn’t load Scripture text.</b><br>${escapeHtml(String(err.message || err))}<br><br>
      You can still use this by linking out to an online Bible, or by pasting your preferred translation into the page.`;
  }
}
function escapeHtml(s){
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

document.addEventListener("click", (e)=>{
  const card = e.target.closest("[data-scripture-ref]");
  if (!card) return;
  const ref = card.getAttribute("data-scripture-ref");
  if (!ref) return;
  openScripture(ref);
});
