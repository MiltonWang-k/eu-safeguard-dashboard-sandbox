
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
  "Türkiye":"🇹🇷","Japan":"🇯🇵","India":"🇮🇳","Taiwan":"🇹🇼","Ukraine":"🇺🇦","Korea":"🇰🇷","Viet Nam":"🇻🇳","Egypt":"🇪🇬","Serbia":"🇷🇸",
  "Brazil":"🇧🇷","United Kingdom":"🇬🇧","Indonesia":"🇮🇩","Australia":"🇦🇺","Saudi Arabia":"🇸🇦","Switzerland":"🇨🇭","Kazakhstan":"🇰🇿","North Macedonia":"🇲🇰",
  "United States":"🇺🇸","China":"🇨🇳","South Africa":"🇿🇦","Singapore":"🇸🇬","Malaysia":"🇲🇾","United Arab Emirates":"🇦🇪","Algeria":"🇩🇿","Moldova":"🇲🇩"
};

const fmtTonnes = value => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value || 0)} mt`;
const fmtYoY = value => value === null || value === undefined || Number.isNaN(value) ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
const badgeClass = value => !value ? "" : /removed|changed/i.test(value) ? "structure" : "neutral";
const yoyClass = value => value === null || value === undefined ? "neutral" : value > 0 ? "up" : value < 0 ? "down" : "neutral";
const uniqueValues = (key, label) => [label, ...new Set(dataset.map(row => row[key]).filter(Boolean))];
function availableCountriesForMainFilters() {
  return ["All countries / quota pools", ...new Set(dataset
    .filter(row => (state.product === "All product categories" || row.product === state.product) && (state.quarter === "All quarters" || row.quarter === state.quarter))
    .map(row => row.country).filter(Boolean))];
}
const isPool = name => POOL_NAMES.has(name);
const displayCountry = name => isPool(name) ? name : `${flagMap[name] || "🌍"} ${name}`;
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
}">${value}</option>`).join('');
  element.value = current;
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
  const top = [...rows].sort((a,b)=>b.allocation-a.allocation).slice(0,5);
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

  els.drawerSubtitle.textContent = `${row.productNo} · ${displayCountry(row.country)} · ${row.quarter}`;
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
      <td>${row.product}</td>
      <td class="mono">${row.quarter}</td>
      <td><div class="country-cell"><span>${displayCountry(row.country)}</span>${row.accessChange ? `<span class="badge ${badgeClass(row.accessChange)}">${row.accessChange}</span>` : ''}</div></td>
      <td class="mono">${fmtTonnes(row.allocation)}</td>
      <td><span class="badge ${yoyClass(row.yoy)}">${fmtYoY(row.yoy)}</span></td>
      <td class="mono">${fmtDuty(row.dutyRate)}</td>
      <td class="mono">${row.orderNumber || '—'}</td>
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
  const options = availableCountriesForMainFilters();
  if (!options.includes(state.country)) state.country = "All countries / quota pools";
  state.country = fillSelect(els.countryFilter, options, state.country);
}

function render() {
  const rows = sortedRows(filteredRows());
  renderTable(rows);
  renderKPIs(rows);
}

async function init() {
  const res = await fetch('./data.json');
  dataset = await res.json();
  document.documentElement.setAttribute('data-theme', state.theme);
  state.quarter = defaultQuarter();
  refreshFilters();
  render();

  els.productFilter.addEventListener('change', e => { state.product = e.target.value; state.quarter = 'All quarters'; state.country = 'All countries / quota pools'; refreshFilters(); render(); });
  els.quarterFilter.addEventListener('change', e => { state.quarter = e.target.value; state.country = 'All countries / quota pools'; refreshFilters(); render(); });
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
}

init();
