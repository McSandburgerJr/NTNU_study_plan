// Lim inn i app.js, rett før linjen "// ---- autofullføring ----".
// Bruker det som allerede finnes i app.js: $, VIEW, state, isLocked, save og render.

// ---- dra og slipp ----
// Pekerhendelser i stedet for HTML5 drag-and-drop, så det virker med både mus og berøring.
// Med mus starter dra etter noen piksler bevegelse; på mobil må man holde inne litt, så vanlig rulling fortsatt virker.
let drag = null,
  suppressUntil = 0,
  scrollRaf = 0;

$("ledger").addEventListener("pointerdown", (e) => {
  if (VIEW || drag || (e.pointerType === "mouse" && e.button !== 0)) return;
  const chip = e.target.closest(".chip.drag");
  if (!chip || e.target.closest("button,select")) return;
  drag = {
    code: chip.dataset.code,
    from: +chip.closest(".sem").dataset.sem,
    chip,
    pointerId: e.pointerId,
    touch: e.pointerType !== "mouse",
    startX: e.clientX,
    startY: e.clientY,
    x: e.clientX,
    y: e.clientY,
    active: false,
    to: null,
    index: 0,
  };
  if (drag.touch) drag.timer = setTimeout(startDrag, 280);
});

document.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.pointerId) return;
  drag.x = e.clientX;
  drag.y = e.clientY;
  if (!drag.active) {
    const dist = Math.hypot(drag.x - drag.startX, drag.y - drag.startY);
    if (drag.touch) {
      if (dist > 8) cancelDrag(); // brukeren ruller, ikke drar
      return;
    }
    if (dist < 5) return;
    startDrag();
  }
  moveGhost();
  findTarget();
});
document.addEventListener("pointerup", (e) => {
  if (drag && e.pointerId === drag.pointerId) endDrag(true);
});
document.addEventListener("pointercancel", (e) => {
  if (drag && e.pointerId === drag.pointerId) endDrag(false);
});
// hindrer at siden ruller mens man drar på mobil
document.addEventListener(
  "touchmove",
  (e) => {
    if (drag && drag.active) e.preventDefault();
  },
  { passive: false },
);
$("ledger").addEventListener("contextmenu", (e) => {
  if (drag) e.preventDefault();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && drag) endDrag(false);
});
// stopp klikket som kommer rett etter et slipp (ellers åpnes lenken eller semesteret velges)
$("ledger").addEventListener(
  "click",
  (e) => {
    if (Date.now() < suppressUntil) {
      e.preventDefault();
      e.stopPropagation();
    }
  },
  true,
);

function startDrag() {
  if (!drag || drag.active || !drag.chip.isConnected) return cancelDrag();
  const r = drag.chip.getBoundingClientRect();
  drag.active = true;
  drag.offX = drag.startX - r.left;
  drag.offY = drag.startY - r.top;
  const g = drag.chip.cloneNode(true);
  g.classList.add("drag-ghost");
  g.style.width = r.width + "px";
  g.style.height = r.height + "px";
  document.body.appendChild(g);
  drag.ghost = g;
  drag.chip.classList.add("dragging");
  document.body.classList.add("is-dragging");
  if (drag.touch && navigator.vibrate) {
    try {
      navigator.vibrate(10);
    } catch (err) {}
  }
  moveGhost();
  findTarget();
  scrollRaf = requestAnimationFrame(autoScroll);
}
function moveGhost() {
  if (drag && drag.ghost)
    drag.ghost.style.transform = `translate(${drag.x - drag.offX}px, ${drag.y - drag.offY}px) rotate(1.5deg)`;
}
function clearMarks() {
  document
    .querySelectorAll(".drop-target,.drop-no,.drop-before,.drop-after")
    .forEach((el) => el.classList.remove("drop-target", "drop-no", "drop-before", "drop-after"));
}
// finner semesteret og plassen under pekeren, og viser en markør der emnet havner
function findTarget() {
  clearMarks();
  drag.to = null;
  const el = document.elementFromPoint(drag.x, drag.y);
  const row = el && el.closest(".sem");
  if (!row) return;
  const s = +row.dataset.sem;
  if (isLocked(s)) {
    row.classList.add("drop-no");
    return;
  }
  const chips = [...row.querySelectorAll(".chip")].filter((c) => c !== drag.chip);
  let idx = chips.length;
  for (let i = 0; i < chips.length; i++) {
    const r = chips[i].getBoundingClientRect();
    if (drag.y < r.top || (drag.y <= r.bottom && drag.x < r.left + r.width / 2)) {
      idx = i;
      break;
    }
  }
  drag.to = s;
  drag.index = idx;
  row.classList.add("drop-target");
  if (idx < chips.length) chips[idx].classList.add("drop-before");
  else if (chips.length) chips[chips.length - 1].classList.add("drop-after");
}
// ruller siden når man drar nær toppen eller bunnen av skjermen
function autoScroll() {
  if (!drag || !drag.active) return;
  const m = 70;
  let dy = 0;
  if (drag.y < m) dy = -Math.ceil(14 * (1 - drag.y / m));
  else if (drag.y > innerHeight - m) dy = Math.ceil(14 * (1 - (innerHeight - drag.y) / m));
  if (dy) {
    scrollBy(0, dy);
    findTarget();
  }
  scrollRaf = requestAnimationFrame(autoScroll);
}
function cancelDrag() {
  if (drag) clearTimeout(drag.timer);
  drag = null;
}
function endDrag(commit) {
  const d = drag;
  cancelDrag();
  if (!d || !d.active) return;
  cancelAnimationFrame(scrollRaf);
  suppressUntil = Date.now() + 400;
  d.ghost.remove();
  d.chip.classList.remove("dragging");
  document.body.classList.remove("is-dragging");
  clearMarks();
  if (commit && d.to != null) moveCourse(d.code, d.from, d.to, d.index);
}
function moveCourse(code, from, to, index) {
  if (isLocked(from) || isLocked(to)) return;
  const src = state.plan[from] || [];
  const item = src.find((c) => c.code === code);
  if (!item) return;
  state.plan[from] = src.filter((c) => c !== item);
  const dest = state.plan[to] || [];
  // samme rekkefølge som på skjermen: faste emner først, så kanskje-emner
  const ordered = [...dest.filter((c) => !c.maybe), ...dest.filter((c) => c.maybe)];
  ordered.splice(Math.min(index, ordered.length), 0, item);
  state.plan[to] = ordered;
  save();
  render();
}
