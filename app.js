
const state = {
  product: "All product categories",
  quarter: "All quarters",
  country: "All countries / quota pools",
  sortKey: "allocation",
  sortDir: "desc",
  theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
};

let dataset = [];

const els = {
  productFilter: document.getElementById("productFilter"),
  quarterFilter: document.getElementById("quarterFilter"),
  countryFilter: document.getElementById("countryFilter"),
  tableBody: document.getElementById("tableBody"),
  resultCount: document.getElementById("resultCount"),
  kpiRows: document.getElementById("kpiRows"),
  kpiCurrent: document.getElementById("kpiCurrent"),
  kpiNext: document.getElementById("kpiNext"),
  kpiChanges: document.getElementById("kpiChanges"),
  currentTop5: document.getElementById("currentTop5"),
  nextTop5: document.getElementById("nextTop5"),
  currentQuarterLabel: document.getElementById("currentQuarterLabel"),
  nextQuarterLabel: document.getElementById("nextQuarterLabel"),
  drawer: document.getElementById("drawer"),
  drawerBackdrop: document.getElementById("drawerBackdrop"),
  drawerBody: document.getElementById("drawerBody"),
  drawerSubtitle: document.getElementById("drawerSubtitle"),
  themeToggle: document.getElementById("themeToggle"),
  drawerClose: document.getElementById("drawerClose")
};

const POOL_NAMES = new Set([
  "Other countries",
  "FTA Quota – Other countries",
  "FTA Quota - Other countries",
  "FTA Quota – CSQ",
  "FTA Quota - CSQ"
]);

const flagMap = {
  "Australia":"au", "Brazil":"br", "China":"cn", "Egypt":"eg", "India":"in", "Indonesia":"id", "Japan":"jp", "Kazakhstan":"kz", "Korea":"kr", "North Macedonia":"mk", "Saudi Arabia":"sa", "Serbia":"rs", "Singapore":"sg", "South Africa":"za", "Switzerland":"ch", "Taiwan":"tw", "Türkiye":"tr", "Ukraine":"ua", "United Kingdom":"gb", "United Kingdom (to Northern Ireland from other parts of the United Kingdom)":"gb", "United States":"us", "Viet Nam":"vn"
};
const escapeHtml = value => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const countryLabel = name => String(name ?? "");
const flagMarkup = name => {
  const code = flagMap[name];
  return code ? `<img class="flag" src="./flags/${code}.svg" width="24" height="18" alt="" aria-hidden="true">` : "";
};
const displayCountry = name => `${flagMarkup(name)}<span>${escapeHtml(countryLabel(name))}</span>`;
const normalizePool = value => String(value || '').replace(/–/g,'-').trim();

function fmtDuty(value){
  if (value === null || value === undefined || value === '') return '—';
  const raw = String(value).trim();
  if (raw.endsWith('%')) return raw;
  const n = Number(raw);
  if (Number.isNaN(n)) return raw;
  return `${(n <= 1 ? n * 100 : n).toFixed(((n <= 1 ? n * 100 : n) % 1) ? 1 : 0)}%`;
}

function parseQuarter(q){
  const m = /^([0-9]{4})-Q([1-4])$/.exec(String(q || ''));
  if (!m) return null;
  return {year:Number(m[1]), quarter:Number(m[2])};
}
function nextQuarter(q){
  const p = parseQuarter(q);
  if (!p) return null;
  return p.quarter === 4 ? `${p.year + 1}-Q1` : `${p.year}-Q${p.quarter + 1}`;
}
function availableQuarters(){
  return [...new Set(dataset.map(r => r.quarter))].sort((a,b)=>{
    const pa=parseQuarter(a), pb=parseQuarter(b);
    if(!pa || !pb) return String(a).localeCompare(String(b));
    return pa.year - pb.year || pa.quarter - pb.quarter;
  });
}
function defaultQuarter(){
  const qs = availableQuarters();
  return qs[0] || '2026-Q3';
}

function fillSelect(element, values, current) {
  const safe = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  element.innerHTML = values.map(value => `<option value="${safe(value)}">${safe(value)}</option>`).join("");
  element.value = values.includes(current) ? current : values[0];
  return element.value;
}

function filteredRows() {
  return dataset.filter(row =>
    (state.product === "All product categories" || row.product === state.product) &&
    (state.quarter === "All quarters" || row.quarter === state.quarter) &&
    (state.country === "All countries / quota pools" || row.country === state.country)
  );
}

function baseRowsForQuarter(quarter){
  return dataset.filter(row =>
    (state.product === "All product categories" || row.product === state.product) &&
    row.quarter === quarter &&
    (state.country === "All countries / quota pools" || row.country === state.country)
  );
}

function sortedRows(rows) {
  const direction = state.sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const values = {
      product: [a.product, b.product],
      quarter: [a.quarter, b.quarter],
      country: [a.country, b.country],
      allocation: [a.allocation, b.allocation],
      yoy: [a.yoy ?? -999, b.yoy ?? -999],
      duty: [Number(String(a.dutyRate).replace('%','')) || 0, Number(String(b.dutyRate).replace('%','')) || 0],
      order: [a.orderNumber || "", b.orderNumber || ""]
    };
    const [left, right] = values[state.sortKey];
    return typeof left === "number" && typeof right === "number"
      ? (left - right) * direction
      : String(left).localeCompare(String(right)) * direction;
  });
}

function renderTop5(container, rows) {
  if (!rows.length) {
    container.innerHTML = `<div class="rank-card"><div class="rank-title">No data</div><div class="rank-meta">No allocations for this quarter.</div></div>`;
    return;
  }
  const top = [...rows].filter(row => !isPool(row.country)).sort((a,b)=>b.allocation-a.allocation).slice(0,5);
  container.innerHTML = top.map((row, idx) => `
    <button class="rank-card" type="button" data-id="${row.id}">
      <div class="rank-top">
        <div>
          <div class="rank-title">${idx + 1}. ${displayCountry(row.country)}</div>
          <div class="rank-meta">${row.productNo} · ${row.quarter}</div>
        </div>
        <div class="rank-title mono">${fmtTonnes(row.allocation)}</div>
      </div>
      <div class="rank-meta">${row.quotaPool} · Duty ${fmtDuty(row.dutyRate)}</div>
    </button>
  `).join('');
}

function sameProductQuarter(row, quarter){
  return dataset.filter(r => r.product === row.product && r.quarter === quarter);
}

function findPoolRow(product, quarter, poolNames){
  const names = Array.isArray(poolNames) ? poolNames : [poolNames];
  return dataset.find(r => r.product === product && r.quarter === quarter && names.some(n => normalizePool(r.country) === normalizePool(n)));
}

function shouldShowCountrySpecific(row){
  return !isPool(row.country);
}

function openDrawer(row) {
  const q = row.quarter;
  const product = row.product;
  const allThisQuarter = sameProductQuarter(row, q);
  const additionalRow = findPoolRow(product, q, ["FTA Quota – CSQ", "FTA Quota - CSQ"]);
  const residualOther = findPoolRow(product, q, ["Other countries"]);
  const residualFtaOther = findPoolRow(product, q, ["FTA Quota – Other countries", "FTA Quota - Other countries"]);

  let sections = [];

  if (shouldShowCountrySpecific(row)) {
    sections.push(`
      <div class="access-item">
        <div class="access-title">Primary quota</div>
        <div class="access-main">Country-specific quota · ${fmtTonnes(row.allocation)}</div>
        <div class="access-sub">Order number: ${row.orderNumber || '—'}.</div>
      </div>
    `);
  } else {
    sections.push(`
      <div class="access-item">
        <div class="access-title">Selected quota pool</div>
        <div class="access-main">${row.country} · ${fmtTonnes(row.allocation)}</div>
        <div class="access-sub">Order number: ${row.orderNumber || '—'}.</div>
      </div>
    `);
  }

  if (shouldShowCountrySpecific(row) && additionalRow) {
    sections.push(`
      <div class="access-item">
        <div class="access-title">Additional access</div>
        <div class="access-main">FTA Quota – CSQ · ${fmtTonnes(additionalRow.allocation)}</div>
        <div class="access-sub">Available only after exhaustion of the respective country-specific quota.</div>
      </div>
    `);
  }

  if (shouldShowCountrySpecific(row)) {
    const residualParts = [];
    if (residualOther) residualParts.push(`<div class="access-main">Other countries · ${fmtTonnes(residualOther.allocation)}</div><div class="access-sub">FCFS residual access.</div>`);
    if (residualFtaOther) residualParts.push(`<div class="access-main">FTA Quota – Other countries · ${fmtTonnes(residualFtaOther.allocation)}</div><div class="access-sub">Residual FTA access or specific FTA residual quota where applicable.</div>`);
    if (residualParts.length) {
      sections.push(`
        <div class="access-item">
          <div class="access-title">Residual access</div>
          ${residualParts.join('')}
        </div>
      `);
    }
  }

  const details = `
    <div class="detail-grid">
      <div class="detail-card"><div class="detail-label">Quarter</div><div class="detail-value mono">${row.quarter}</div></div>
      <div class="detail-card"><div class="detail-label">Additional duty</div><div class="detail-value mono">${fmtDuty(row.dutyRate)}</div></div>
      <div class="detail-card"><div class="detail-label">YoY change</div><div class="detail-value mono">${fmtYoY(row.yoy)}</div></div>
      <div class="detail-card"><div class="detail-label">Compare quarter</div><div class="detail-value mono">${row.compareQuarter || '—'}</div></div>
    </div>
  `;

  els.drawerSubtitle.textContent = `${row.productNo} · ${row.country} · ${row.quarter}`;
  document.getElementById('drawerTitle').textContent = row.product;
  els.drawerBody.innerHTML = `<div class="access-stack">${sections.join('')}</div>${details}${row.notes ? `<div class="detail-card"><div class="detail-label">Notes</div><div>${row.notes}</div></div>` : ''}`;
  els.drawer.classList.add('open');
  els.drawerBackdrop.classList.add('open');
  els.drawer.setAttribute('aria-hidden', 'false');
}

function closeDrawer(){
  els.drawer.classList.remove('open');
  els.drawerBackdrop.classList.remove('open');
  els.drawer.setAttribute('aria-hidden', 'true');
}

function renderTable(rows) {
  els.resultCount.textContent = String(rows.length);
  els.tableBody.innerHTML = rows.map(row => `
    <tr data-id="${row.id}">
      <td data-label="Product">${escapeHtml(row.product)}</td>
      <td data-label="Quarter" class="mono">${escapeHtml(row.quarter)}</td>
      <td data-label="Country / quota pool"><div class="country-cell">${displayCountry(row.country)}${row.accessChange ? `<span class="badge ${badgeClass(row.accessChange)}">${row.accessChange}</span>` : ''}</div></td>
      <td data-label="Allocation" class="mono">${fmtTonnes(row.allocation)}</td>
      <td data-label="YoY"><span class="badge ${yoyClass(row.yoy)}">${fmtYoY(row.yoy)}</span></td>
      <td data-label="Additional duty" class="mono">${fmtDuty(row.dutyRate)}</td>
      <td data-label="Order number" class="mono">${row.orderNumber || '—'}</td>
    </tr>
  `).join('');
}

function renderKPIs(rows) {
  els.kpiRows.textContent = String(rows.length);
  const selectedQuarter = state.quarter === 'All quarters' ? defaultQuarter() : state.quarter;
  const nextQ = nextQuarter(selectedQuarter);
  const currentRows = baseRowsForQuarter(selectedQuarter);
  const nextRows = nextQ ? baseRowsForQuarter(nextQ) : [];
  const currentTotal = currentRows.reduce((sum, row) => sum + (Number(row.allocation) || 0), 0);
  const nextTotal = nextRows.reduce((sum, row) => sum + (Number(row.allocation) || 0), 0);
  els.currentQuarterLabel.textContent = `${selectedQuarter} total`;
  els.nextQuarterLabel.textContent = `${nextQ || 'Next quarter'} total`;
  els.kpiCurrent.textContent = fmtTonnes(currentTotal);
  els.kpiNext.textContent = fmtTonnes(nextTotal);
  els.kpiChanges.textContent = String(rows.filter(r => r.accessChange).length);
  renderTop5(els.currentTop5, currentRows);
  renderTop5(els.nextTop5, nextRows);
}

function refreshFilters() {
  state.product = fillSelect(els.productFilter, uniqueValues("product", "All product categories"), state.product);
  state.quarter = fillSelect(els.quarterFilter, ["All quarters", ...availableQuarters()], state.quarter);
  let options = availableCountriesForMainFilters();
  if (state.country !== "All countries / quota pools" && !options.includes(state.country)) {
    options = [...options, state.country];
  }
  state.country = fillSelect(els.countryFilter, options.map(displayCountryText), displayCountryText(state.country));
  const selectedText = els.countryFilter.value;
  const matched = options.find(name => displayCountryText(name) === selectedText);
  state.country = matched || "All countries / quota pools";
}

function render() {
  const rows = sortedRows(filteredRows());
  renderTable(rows);
  renderKPIs(rows);
}

async function init() {
  try {
    const res = await fetch('./data.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} while loading data.json`);
    dataset = await res.json();
    if (!Array.isArray(dataset) || !dataset.length) throw new Error('data.json is empty or invalid');
    document.documentElement.setAttribute('data-theme', state.theme);
    state.quarter = defaultQuarter();
    refreshFilters();
    render();

    els.productFilter.addEventListener('change', e => { state.product = e.target.value; state.quarter = 'All quarters'; refreshFilters(); render(); });
    els.quarterFilter.addEventListener('change', e => { state.quarter = e.target.value; refreshFilters(); render(); });
    els.countryFilter.addEventListener('change', e => { state.country = e.target.value; render(); });

    document.querySelectorAll('[data-sort]').forEach(btn => btn.addEventListener('click', () => {
      const key = btn.dataset.sort;
      if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      else { state.sortKey = key; state.sortDir = 'desc'; }
      render();
    }));

    els.tableBody.addEventListener('click', e => {
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      const row = dataset.find(r => String(r.id) === tr.dataset.id);
      if (row) openDrawer(row);
    });

    [els.currentTop5, els.nextTop5].forEach(el => el.addEventListener('click', e => {
      const btn = e.target.closest('[data-id]');
      if (!btn) return;
      const row = dataset.find(r => String(r.id) === btn.dataset.id);
      if (row) openDrawer(row);
    }));

    els.drawerBackdrop.addEventListener('click', closeDrawer);
    els.drawerClose.addEventListener('click', closeDrawer);
    els.themeToggle.addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', state.theme);
    });
  } catch (error) {
    console.error('Init failed:', error);
    els.resultCount.textContent = '0';
    els.tableBody.innerHTML = `<tr><td colspan="7">Data failed to load: ${escapeHtml(error.message)}</td></tr>`;
    [els.productFilter, els.quarterFilter, els.countryFilter].forEach(el => {
      el.innerHTML = '<option>Load error</option>';
    });
  }
}

init();
