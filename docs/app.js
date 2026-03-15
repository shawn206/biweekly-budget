const STORAGE_KEY = "biweeklyBudgetData";
const PERIOD_DAYS = 14;
let memoryStore = null;

const setupForm = document.getElementById("setup-form");
const spendForm = document.getElementById("spend-form");
const startDateInput = document.getElementById("start-date");
const totalBudgetInput = document.getElementById("total-budget");
const spendDateInput = document.getElementById("spend-date");
const spendAmountInput = document.getElementById("spend-amount");
const resetBtn = document.getElementById("reset-btn");
const resetDayBtn = document.getElementById("reset-day-btn");
const nextPeriodBtn = document.getElementById("next-period-btn");
const exportBtn = document.getElementById("export-btn");
const importBtn = document.getElementById("import-btn");
const importFileInput = document.getElementById("import-file");
const entriesBody = document.getElementById("entries-body");
const meterTicks = document.getElementById("meter-ticks");

const statTotal = document.getElementById("stat-total");
const statDailyBudget = document.getElementById("stat-daily-budget");
const statTrend = document.getElementById("stat-trend");
const statSpent = document.getElementById("stat-spent");
const statRemaining = document.getElementById("stat-remaining");
const statDaysLeft = document.getElementById("stat-days-left");
const meterFill = document.getElementById("meter-fill");
const expandedDates = new Set();

function localIsoDate() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const todayIso = localIsoDate();
spendDateInput.value = todayIso;

function storageAvailable() {
  try {
    localStorage.setItem("__budget_test__", "1");
    localStorage.removeItem("__budget_test__");
    return true;
  } catch {
    return false;
  }
}

const canUseLocalStorage = storageAvailable();

function currency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function signedCurrency(value) {
  const rounded = roundMoney(value);
  if (rounded > 0) {
    return `+${currency(rounded)}`;
  }
  if (rounded < 0) {
    return `-${currency(Math.abs(rounded))}`;
  }
  return currency(0);
}

function setTrendDisplay(value) {
  const rounded = roundMoney(value);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
  const amount = currency(Math.abs(rounded));
  const signClass = sign ? "trend-sign" : "trend-sign trend-sign-empty";
  statTrend.innerHTML = `<span class="${signClass}">${sign}</span><span class="trend-value">${amount}</span><span class="${signClass}" aria-hidden="true">${sign}</span>`;
}

function focusExpandedDate(date) {
  expandedDates.clear();
  if (date) {
    expandedDates.add(date);
  }
}

function createTransactionId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function parseSpendExpression(rawInput) {
  const cleaned = String(rawInput || "").replace(/\s+/g, "");
  if (!cleaned) {
    throw new Error("Enter an amount.");
  }
  if (!/^\d+(\.\d{1,2})?(\+\d+(\.\d{1,2})?)*$/.test(cleaned)) {
    throw new Error("Use amounts like 12.50 or sums like 8.50+7.20.");
  }

  const total = cleaned
    .split("+")
    .map((part) => Number(part))
    .reduce((sum, value) => sum + value, 0);

  return roundMoney(total);
}

function formatIsoDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatShortDate(date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

function formatDisplayDate(isoDate) {
  const [yyyy, mm, dd] = isoDate.split("-");
  return `${mm}/${dd}/${yyyy}`;
}

function getPeriodDates(startDateIso) {
  const start = new Date(startDateIso + "T00:00:00");
  const dates = [];
  for (let i = 0; i < PERIOD_DAYS; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(formatIsoDate(date));
  }
  return dates;
}

function shiftIsoDate(isoDate, days) {
  const date = new Date(isoDate + "T00:00:00");
  date.setDate(date.getDate() + days);
  return formatIsoDate(date);
}

function normalizeEntriesByDate(parsedEntries, startDateIso) {
  const dates = getPeriodDates(startDateIso);
  const normalized = Object.fromEntries(dates.map((date) => [date, 0]));

  if (Array.isArray(parsedEntries)) {
    for (const item of parsedEntries) {
      if (item && typeof item.date === "string" && dates.includes(item.date)) {
        normalized[item.date] = Number(item.amount || 0);
      }
    }
    return normalized;
  }

  if (parsedEntries && typeof parsedEntries === "object") {
    for (const date of dates) {
      normalized[date] = Number(parsedEntries[date] || 0);
    }
  }

  return normalized;
}

function normalizeTransaction(rawTransaction) {
  if (typeof rawTransaction === "number") {
    return rawTransaction > 0
      ? { id: createTransactionId(), amount: roundMoney(rawTransaction) }
      : null;
  }

  if (!rawTransaction || typeof rawTransaction !== "object") {
    return null;
  }

  const amount = roundMoney(Number(rawTransaction.amount || 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return {
    id: typeof rawTransaction.id === "string" && rawTransaction.id ? rawTransaction.id : createTransactionId(),
    amount,
  };
}

function transactionsFromAmount(amount) {
  const rounded = roundMoney(Number(amount || 0));
  return rounded > 0 ? [{ id: createTransactionId(), amount: rounded }] : [];
}

function normalizeTransactionsByDate(parsedTransactions, startDateIso, fallbackEntries) {
  const dates = getPeriodDates(startDateIso);
  const normalized = Object.fromEntries(dates.map((date) => [date, []]));

  if (parsedTransactions && typeof parsedTransactions === "object" && !Array.isArray(parsedTransactions)) {
    for (const date of dates) {
      const rawList = parsedTransactions[date];
      if (!Array.isArray(rawList)) {
        continue;
      }

      normalized[date] = rawList
        .map((transaction) => normalizeTransaction(transaction))
        .filter(Boolean);
    }
    return normalized;
  }

  const fallbackByDate = normalizeEntriesByDate(fallbackEntries, startDateIso);
  for (const date of dates) {
    normalized[date] = transactionsFromAmount(fallbackByDate[date]);
  }
  return normalized;
}

function dayTotalsFromTransactions(transactionsByDate, startDateIso) {
  const dates = getPeriodDates(startDateIso);
  const totals = Object.fromEntries(dates.map((date) => [date, 0]));

  for (const date of dates) {
    const total = (transactionsByDate[date] || []).reduce((sum, transaction) => {
      return sum + Number(transaction.amount || 0);
    }, 0);
    totals[date] = roundMoney(total);
  }

  return totals;
}

function coerceDataForSave(rawData) {
  const startDate = typeof rawData?.startDate === "string" && rawData.startDate ? rawData.startDate : todayIso;
  const totalBudget = Number(rawData?.totalBudget || 0);
  return {
    startDate,
    totalBudget: Number.isFinite(totalBudget) ? totalBudget : 0,
    transactionsByDate: normalizeTransactionsByDate(
      rawData?.transactionsByDate,
      startDate,
      rawData?.entriesByDate ?? rawData?.entries
    ),
  };
}

function loadData() {
  const raw = canUseLocalStorage ? localStorage.getItem(STORAGE_KEY) : memoryStore;
  if (!raw) {
    return coerceDataForSave({});
  }

  try {
    const parsed = JSON.parse(raw);
    const normalized = coerceDataForSave(parsed);
    const shouldPersistNormalized =
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.transactionsByDate;

    if (shouldPersistNormalized) {
      saveData(normalized);
    }

    return normalized;
  } catch {
    return coerceDataForSave({});
  }
}

function saveData(data) {
  const serialized = JSON.stringify(data);
  if (canUseLocalStorage) {
    localStorage.setItem(STORAGE_KEY, serialized);
    return;
  }
  memoryStore = serialized;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function computeSpent(transactionsByDate) {
  return Object.values(transactionsByDate).reduce((sum, transactions) => {
    const dayTotal = (transactions || []).reduce((daySum, transaction) => {
      return daySum + Number(transaction.amount || 0);
    }, 0);
    return sum + dayTotal;
  }, 0);
}

function dailyBudget(totalBudget) {
  return roundMoney(Number(totalBudget || 0) / PERIOD_DAYS);
}

function currentTrendAmount(startDateIso, entriesByDate, targetDailyBudget) {
  const dates = getPeriodDates(startDateIso);
  let cumulativeSpend = 0;

  for (let i = 0; i < dates.length; i += 1) {
    const date = dates[i];
    if (date > todayIso) {
      break;
    }

    cumulativeSpend = roundMoney(cumulativeSpend + Number(entriesByDate[date] || 0));

    if (date === todayIso) {
      const expectedSpendToDate = roundMoney(targetDailyBudget * (i + 1));
      return roundMoney(expectedSpendToDate - cumulativeSpend);
    }
  }

  return 0;
}

function daysLeft(startDate) {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + PERIOD_DAYS - 1);
  const now = new Date();
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = end - nowMidnight;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(0, Math.min(PERIOD_DAYS, diffDays));
}

function elapsedDays(startDateIso) {
  const start = new Date(startDateIso + "T00:00:00");
  const today = new Date(todayIso + "T00:00:00");
  const diffMs = today - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(0, Math.min(PERIOD_DAYS, diffDays));
}

function meterRemainingAmount(remaining, targetDailyBudget, elapsed) {
  if (targetDailyBudget <= 0) {
    return Math.max(0, remaining);
  }

  if (elapsed >= 1 && elapsed <= PERIOD_DAYS) {
    return roundMoney(Math.max(0, remaining) + targetDailyBudget / 2);
  }

  return Math.max(0, remaining);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function trendColor(trendAmount, targetDailyBudget) {
  if (targetDailyBudget <= 0) {
    return "hsl(145, 62%, 36%)";
  }

  // On or ahead of budget pace should read as healthy green.
  if (trendAmount >= 0) {
    return "hsl(120, 70%, 42%)";
  }

  // One full day behind (or worse) trends to red, with yellow/orange in between.
  const deficitRatio = clamp(Math.abs(trendAmount) / targetDailyBudget, 0, 1);
  const hue = 120 * (1 - deficitRatio);
  return `hsl(${hue.toFixed(0)}, 70%, 42%)`;
}

function renderTicks(startDateIso) {
  meterTicks.innerHTML = "";

  const start = new Date(startDateIso + "T00:00:00");
  const today = new Date(todayIso + "T00:00:00");

  for (let i = 0; i < PERIOD_DAYS; i += 1) {
    const tickDate = new Date(start);
    tickDate.setDate(start.getDate() + i);

    const row = document.createElement("div");
    row.className = "tick-row";

    const tick = document.createElement("span");
    tick.className = "tick";

    const label = document.createElement("span");
    label.className = "tick-label";
    label.textContent = `Day ${i + 1} - ${formatShortDate(tickDate)}`;

    row.title = `Day ${i + 1}: ${formatIsoDate(tickDate)}`;

    if (tickDate < today) {
      row.classList.add("past");
    }
    if (tickDate.getTime() === today.getTime()) {
      row.classList.add("today");
    }

    row.appendChild(tick);
    row.appendChild(label);
    meterTicks.appendChild(row);
  }
}

function renderTransactions(date, transactions) {
  if (!transactions.length) {
    return '<div class="transactions-empty">No transactions logged.</div>';
  }

  return `
    <table class="transactions-table">
      <thead>
        <tr>
          <th>Transaction</th>
          <th>Amount</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${transactions
          .map((transaction, index) => {
            return `
              <tr>
                <td>${index + 1}</td>
                <td>${currency(transaction.amount)}</td>
                <td class="transaction-actions">
                  <button type="button" class="secondary transaction-btn" data-action="edit-transaction" data-date="${date}" data-id="${transaction.id}">Edit</button>
                  <button type="button" class="secondary transaction-btn" data-action="delete-transaction" data-date="${date}" data-id="${transaction.id}">Delete</button>
                </td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function renderEntries(startDateIso, entriesByDate, transactionsByDate, targetDailyBudget) {
  entriesBody.innerHTML = "";
  const dates = getPeriodDates(startDateIso);
  let cumulativeSpend = 0;

  for (let i = 0; i < dates.length; i += 1) {
    const date = dates[i];
    const tr = document.createElement("tr");
    if (date === todayIso) {
      tr.classList.add("today-row");
    }

    const dayCell = document.createElement("td");
    dayCell.innerHTML = `
      <button
        type="button"
        class="day-toggle"
        data-action="toggle-day"
        data-date="${date}"
        aria-expanded="${expandedDates.has(date) ? "true" : "false"}"
        aria-label="${expandedDates.has(date) ? "Collapse" : "Expand"} ${formatDisplayDate(date)} transactions"
      >
        <span class="day-toggle-marker">${expandedDates.has(date) ? "-" : "+"}</span>
      </button>
    `;

    const dateCell = document.createElement("td");
    dateCell.textContent = formatDisplayDate(date);

    const amountCell = document.createElement("td");
    const spendAmount = roundMoney(Number(entriesByDate[date] || 0));
    cumulativeSpend = roundMoney(cumulativeSpend + spendAmount);
    amountCell.textContent = currency(spendAmount);

    if (date > todayIso) {
      amountCell.classList.add("spend-on");
    } else if (spendAmount > targetDailyBudget) {
      amountCell.classList.add("spend-over");
    } else if (spendAmount < targetDailyBudget) {
      amountCell.classList.add("spend-under");
    } else {
      amountCell.classList.add("spend-on");
    }

    const deltaCell = document.createElement("td");
    if (date > todayIso) {
      deltaCell.textContent = "";
      deltaCell.classList.add("delta-neutral");
    } else {
      const expectedSpendToDate = roundMoney(targetDailyBudget * (i + 1));
      const cumulativeDelta = roundMoney(expectedSpendToDate - cumulativeSpend);
      deltaCell.textContent = signedCurrency(cumulativeDelta);

      if (cumulativeDelta === 0) {
        deltaCell.classList.add("delta-neutral");
      } else if (cumulativeDelta > 0) {
        deltaCell.classList.add("delta-positive");
      } else {
        deltaCell.classList.add("delta-negative");
      }
    }

    tr.appendChild(dayCell);
    tr.appendChild(dateCell);
    tr.appendChild(amountCell);
    tr.appendChild(deltaCell);
    entriesBody.appendChild(tr);

    const detailRow = document.createElement("tr");
    detailRow.className = "entry-detail-row";
    if (!expandedDates.has(date)) {
      detailRow.hidden = true;
    }

    const detailCell = document.createElement("td");
    detailCell.colSpan = 4;
    detailCell.innerHTML = `
      <div class="transactions-panel">
        ${renderTransactions(date, transactionsByDate[date] || [])}
      </div>
    `;

    detailRow.appendChild(detailCell);
    entriesBody.appendChild(detailRow);
  }
}

function exportData() {
  const data = loadData();
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `biweekly-budget-${todayIso}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importDataFromText(text) {
  const parsed = JSON.parse(text);
  const source = parsed && typeof parsed === "object" && parsed.data ? parsed.data : parsed;
  const data = coerceDataForSave(source);
  saveData(data);
  render();
}

function render() {
  const data = loadData();
  const entriesByDate = dayTotalsFromTransactions(data.transactionsByDate, data.startDate || todayIso);
  const spent = computeSpent(data.transactionsByDate);
  const total = Number(data.totalBudget || 0);
  const perDayBudget = dailyBudget(total);
  const trendAmount = currentTrendAmount(data.startDate || todayIso, entriesByDate, perDayBudget);
  const elapsed = elapsedDays(data.startDate || todayIso);
  const remaining = total - spent;
  const remainingForMeter = meterRemainingAmount(remaining, perDayBudget, elapsed);
  const remainingPct = total > 0 ? Math.max(0, Math.min(100, (remainingForMeter / total) * 100)) : 0;
  const color = trendColor(trendAmount, perDayBudget);

  startDateInput.value = data.startDate || todayIso;
  totalBudgetInput.value = total > 0 ? total : "";

  statTotal.textContent = currency(total);
  statDailyBudget.textContent = currency(perDayBudget);
  setTrendDisplay(trendAmount);
  statTrend.className = `meter-trend ${trendAmount > 0 ? "trend-positive" : trendAmount < 0 ? "trend-negative" : "trend-neutral"}`;
  statSpent.textContent = currency(spent);
  statRemaining.textContent = currency(remaining);
  statDaysLeft.textContent = String(daysLeft(data.startDate || todayIso));
  meterFill.style.height = `${remainingPct}%`;
  meterFill.style.background = `linear-gradient(0deg, ${color}, ${color})`;

  renderTicks(data.startDate || todayIso);
  renderEntries(data.startDate || todayIso, entriesByDate, data.transactionsByDate, perDayBudget);
}

setupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const previous = loadData();
  const startDate = startDateInput.value;
  const data = {
    startDate,
    totalBudget: Number(totalBudgetInput.value || 0),
    transactionsByDate: normalizeTransactionsByDate(
      previous.transactionsByDate,
      startDate,
      dayTotalsFromTransactions(previous.transactionsByDate, previous.startDate || todayIso)
    ),
  };
  saveData(data);
  render();
});

nextPeriodBtn.addEventListener("click", () => {
  const current = loadData();
  const startDate = startDateInput.value || current.startDate || todayIso;
  const nextStartDate = shiftIsoDate(startDate, PERIOD_DAYS);
  const totalBudget = Number(totalBudgetInput.value || current.totalBudget || 0);
  const data = {
    startDate: nextStartDate,
    totalBudget,
    transactionsByDate: normalizeTransactionsByDate(null, nextStartDate, null),
  };

  focusExpandedDate("");
  saveData(data);
  render();
});

spendForm.addEventListener("submit", (event) => {
  event.preventDefault();

  let amount;
  try {
    amount = parseSpendExpression(spendAmountInput.value);
  } catch (error) {
    alert(error.message);
    return;
  }

  if (amount <= 0) return;

  const data = loadData();
  const validDates = getPeriodDates(data.startDate || todayIso);
  if (!validDates.includes(spendDateInput.value)) {
    alert("Spend date must be within the current 14-day period.");
    return;
  }

  const transactions = data.transactionsByDate[spendDateInput.value] || [];
  data.transactionsByDate[spendDateInput.value] = transactions.concat({
    id: createTransactionId(),
    amount,
  });
  focusExpandedDate(spendDateInput.value);
  saveData(data);

  spendAmountInput.value = "";
  render();
});

resetDayBtn.addEventListener("click", () => {
  const data = loadData();
  const validDates = getPeriodDates(data.startDate || todayIso);
  if (!validDates.includes(spendDateInput.value)) {
    alert("Selected date must be within the current 14-day period.");
    return;
  }

  data.transactionsByDate[spendDateInput.value] = [];
  focusExpandedDate(spendDateInput.value);
  saveData(data);
  render();
});

exportBtn.addEventListener("click", () => {
  exportData();
});

importBtn.addEventListener("click", () => {
  importFileInput.click();
});

importFileInput.addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    importDataFromText(text);
    alert("Budget data imported successfully.");
  } catch {
    alert("Import failed. Please select a valid budget JSON export file.");
  } finally {
    importFileInput.value = "";
  }
});

resetBtn.addEventListener("click", () => {
  const confirmReset = window.confirm("Reset current period and clear all entries?");
  if (!confirmReset) return;
  if (canUseLocalStorage) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    memoryStore = null;
  }
  render();
});

entriesBody.addEventListener("click", (event) => {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) {
    return;
  }

  const { action, date, id } = actionTarget.dataset;

  if (action === "toggle-day") {
    if (expandedDates.has(date)) {
      expandedDates.delete(date);
    } else {
      expandedDates.add(date);
    }
    render();
    return;
  }

  const data = loadData();
  const transactions = [...(data.transactionsByDate[date] || [])];
  const index = transactions.findIndex((transaction) => transaction.id === id);
  if (index === -1) {
    return;
  }

  if (action === "delete-transaction") {
    transactions.splice(index, 1);
    data.transactionsByDate[date] = transactions;
    focusExpandedDate(date);
    saveData(data);
    render();
    return;
  }

  if (action === "edit-transaction") {
    const existingAmount = transactions[index].amount;
    const nextValue = window.prompt(
      "Update this transaction amount. You can use + to calculate a single replacement amount.",
      String(existingAmount.toFixed(2))
    );

    if (nextValue === null) {
      return;
    }

    let replacementAmount;
    try {
      replacementAmount = parseSpendExpression(nextValue);
    } catch (error) {
      alert(error.message);
      return;
    }

    transactions.splice(
      index,
      1,
      { id: createTransactionId(), amount: replacementAmount }
    );
    data.transactionsByDate[date] = transactions;
    focusExpandedDate(date);
    saveData(data);
    render();
  }
});

if (!canUseLocalStorage) {
  const note = document.createElement("small");
  note.textContent = "Local storage is blocked in this browser context. Data resets when this tab closes.";
  document.querySelector(".status").appendChild(note);
}

render();


