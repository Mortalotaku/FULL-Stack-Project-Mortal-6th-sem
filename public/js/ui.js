/** Shared interactive UI — toasts, modals, storage, loaders */
(function () {
  const STUDENT_KEY = 'campus_erp_student_id';

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s ?? '';
    return d.innerHTML;
  }

  function initShell() {
    if (!document.getElementById('toast-root')) {
      const root = document.createElement('div');
      root.id = 'toast-root';
      root.className = 'toast-root';
      document.body.appendChild(root);
    }
    if (!document.getElementById('modal-root')) {
      const root = document.createElement('div');
      root.id = 'modal-root';
      root.className = 'modal-root';
      root.innerHTML = `
        <div class="modal-backdrop" hidden></div>
        <div class="modal-panel" hidden role="dialog" aria-modal="true">
          <button type="button" class="modal-close" aria-label="Close">&times;</button>
          <div class="modal-body"></div>
        </div>`;
      document.body.appendChild(root);
      root.querySelector('.modal-backdrop').onclick = closeModal;
      root.querySelector('.modal-close').onclick = closeModal;
    }
    markActiveNav();
    injectStudentBar();
  }

  function markActiveNav() {
    const path = location.pathname.replace(/\/$/, '') || '/';
    document.querySelectorAll('nav.tabs a').forEach((a) => {
      const href = a.getAttribute('href').replace(/\/$/, '') || '/';
      const match = href === path || (href !== '/' && path.endsWith(href));
      a.classList.toggle('active', match || (path === '/' && href === '/'));
    });
  }

  function getStudentId() {
    return localStorage.getItem(STUDENT_KEY) || '';
  }

  function setStudentId(id) {
    if (id) localStorage.setItem(STUDENT_KEY, id);
    else localStorage.removeItem(STUDENT_KEY);
    document.querySelectorAll('[data-student-input]').forEach((el) => {
      if (!el.value || el.dataset.syncStudent === 'true') el.value = id;
    });
    document.querySelectorAll('.student-chip').forEach((chip) => {
      chip.classList.toggle('selected', chip.dataset.id === id);
    });
    const label = document.getElementById('student-bar-label');
    if (label) label.textContent = id ? `Signed in as ${id}` : 'Pick your ERP student ID';
  }

  function injectStudentBar() {
    if (document.getElementById('student-bar')) return;
    const header = document.querySelector('header.top');
    if (!header) return;

    const bar = document.createElement('div');
    bar.id = 'student-bar';
    bar.className = 'student-bar no-print';
    bar.innerHTML = `
      <span id="student-bar-label">Pick your ERP student ID</span>
      <div class="student-chips">
        <button type="button" class="student-chip" data-id="STU-2024-001">Aisha</button>
        <button type="button" class="student-chip" data-id="STU-2024-002">Rohan</button>
        <button type="button" class="student-chip" data-id="STU-2024-003">Priya</button>
      </div>`;
    header.appendChild(bar);

    bar.querySelectorAll('.student-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        setStudentId(btn.dataset.id);
        toast(`Logged in as ${btn.dataset.id}`, 'success');
      });
    });
    setStudentId(getStudentId());
  }

  function toast(message, type = 'info', ms = 3200) {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = `toast toast-${type} toast-in`;
    el.textContent = message;
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('toast-visible'));
    setTimeout(() => {
      el.classList.remove('toast-visible');
      setTimeout(() => el.remove(), 300);
    }, ms);
  }

  function openModal(title, html) {
    const root = document.getElementById('modal-root');
    const panel = root.querySelector('.modal-panel');
    const body = root.querySelector('.modal-body');
    body.innerHTML = `<h2 class="modal-title">${escapeHtml(title)}</h2>${html}`;
    root.querySelector('.modal-backdrop').hidden = false;
    panel.hidden = false;
    requestAnimationFrame(() => {
      root.classList.add('modal-open');
    });
  }

  function closeModal() {
    const root = document.getElementById('modal-root');
    root.classList.remove('modal-open');
    setTimeout(() => {
      root.querySelector('.modal-backdrop').hidden = true;
      root.querySelector('.modal-panel').hidden = true;
    }, 200);
  }

  function skeletonCards(n = 3) {
    return Array.from({ length: n }, () => `
      <div class="event-row skeleton-card">
        <div class="skeleton-line w60"></div>
        <div class="skeleton-line w40"></div>
        <div class="skeleton-line w80"></div>
      </div>`).join('');
  }

  function setLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle('is-loading', loading);
    if (loading) btn.dataset.originalText = btn.textContent;
    btn.textContent = loading ? 'Please wait…' : (btn.dataset.originalText || btn.textContent);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied to clipboard', 'success');
      return true;
    } catch {
      toast('Copy failed', 'error');
      return false;
    }
  }

  function capacityPercent(enrolled, capacity) {
    return Math.min(100, Math.round((enrolled / capacity) * 100));
  }

  function renderCapacityBar(enrolled, capacity) {
    const pct = capacityPercent(enrolled, capacity);
    const full = pct >= 100;
    return `
      <div class="capacity-wrap">
        <div class="capacity-label">
          <span>${enrolled} / ${capacity} enrolled</span>
          <span>${pct}%</span>
        </div>
        <div class="capacity-track">
          <div class="capacity-fill ${full ? 'full' : ''}" style="width:${pct}%"></div>
        </div>
      </div>`;
  }

  function celebrate(el) {
    if (!el) return;
    el.classList.add('celebrate');
    setTimeout(() => el.classList.remove('celebrate'), 800);
  }

  document.addEventListener('DOMContentLoaded', initShell);

  window.UI = {
    escapeHtml,
    toast,
    openModal,
    closeModal,
    skeletonCards,
    setLoading,
    copyText,
    getStudentId,
    setStudentId,
    renderCapacityBar,
    capacityPercent,
    celebrate,
    STUDENT_KEY,
  };
})();
