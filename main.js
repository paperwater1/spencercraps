/* Craps Strategy Simulator */
const iterationsInput = document.getElementById("iterations");
const baseBetInput = document.getElementById("baseBet");
const reducedBetInput = document.getElementById("reducedBet");
const oddsMultInput = document.getElementById("oddsMult");
const runBtn = document.getElementById("runBtn");
const resetBtn = document.getElementById("resetBtn");
const logEl = document.getElementById("log");
const statsEl = document.getElementById("stats");
const sentenceEl = document.getElementById("strategySentence");
const chipsWrap = document.getElementById("pointChips");

let chart;

const ALL_POINTS = [4, 5, 6, 8, 9, 10];
// state options: keep, odds, lower
let pointStates = {
  4: "odds",
  5: "lower",
  6: "lower",
  8: "lower",
  9: "lower",
  10: "odds",
};

const STATE_CYCLE = ["keep", "odds", "lower"]; // clicking cycles

function buildChips() {
  chipsWrap.innerHTML = "";
  ALL_POINTS.forEach((pt) => {
    const div = document.createElement("div");
    div.className = `chip ${pointStates[pt]}`;
    div.textContent = pt;
    div.addEventListener("click", () => {
      // cycle state
      const current = pointStates[pt];
      const next = STATE_CYCLE[(STATE_CYCLE.indexOf(current) + 1) % STATE_CYCLE.length];
      pointStates[pt] = next;
      div.className = `chip ${next}`;
      updateSentence();
    });
    chipsWrap.appendChild(div);
  });
}

runBtn.addEventListener("click", () => {
  const iterations = parseInt(iterationsInput.value, 10);
  const baseBet = parseFloat(baseBetInput.value);
  const reducedBet = parseFloat(reducedBetInput.value);
  const oddsMult = parseFloat(oddsMultInput.value);
  runSimulation({ iterations, baseBet, reducedBet, oddsMult, pointStates: { ...pointStates } });
});

resetBtn.addEventListener("click", () => {
  if (chart) {
    chart.destroy();
  }
  logEl.textContent = "";
  statsEl.innerHTML = "";
  updateSentence();
});

function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

function comeOutResult() {
  const d1 = rollDice();
  const d2 = rollDice();
  return d1 + d2;
}

function simulateShooter(cfg, bankroll, logArr) {
  const { baseBet, reducedBet, oddsMult, pointStates } = cfg;

  // Place base bet
  let betAmount = baseBet;
  const comeOut = comeOutResult();
  let oddsRisk = 0;
  let payout = 0;
  let risk = betAmount;

  const isComeOutLoss = comeOut === 7 || comeOut === 11;
  const isComeOutWin = comeOut === 2 || comeOut === 3;
  const isPush = comeOut === 12;

  if (isComeOutLoss) {
    bankroll -= betAmount;
    logArr.push(`CO ${comeOut}: Lose $${betAmount}`);
    return { bankroll, risk };
  }
  if (isComeOutWin) {
    bankroll += betAmount;
    logArr.push(`CO ${comeOut}: Win $${betAmount}`);
    return { bankroll, risk };
  }
  if (isPush) {
    logArr.push(`CO 12: Push`);
    return { bankroll, risk };
  }

  // Point established
  const point = comeOut;
  const behavior = pointStates[point] || "keep";
  if (behavior === "lower") {
    betAmount = reducedBet;
    risk = betAmount;
  } else if (behavior === "odds") {
    oddsRisk = betAmount * oddsMult;
    risk = betAmount + oddsRisk;
  }

  // At this stage we cannot change the original wager; for simplicity we keep both bet + odds at risk
  let roll;
  do {
    roll = comeOutResult();
  } while (roll !== 7 && roll !== point);

  if (roll === 7) {
    // Do Not Pass wins
    bankroll += betAmount;
    if (oddsRisk) {
      // laying odds on 4/10 pays 1:2 risk->win ratio
      const oddsWin = oddsRisk / 2;
      bankroll += oddsWin;
      payout += oddsWin;
    }
    payout += betAmount;
    logArr.push(`Point ${point} → 7-out: Win $${payout}`);
  } else {
    // Do Not Pass loses
    bankroll -= betAmount;
    if (oddsRisk) {
      bankroll -= oddsRisk;
    }
    logArr.push(`Point ${point} hit: Lose $${betAmount + oddsRisk}`);
  }
  return { bankroll, risk };
}

function runSimulation(cfg) {
  let bankroll = 0;
  const bankrollHistory = [bankroll];
  const logArr = [];
  let totalRisk = 0;
  let wins = 0;
  let losses = 0;
  let winStreak = 0;
  let lossStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  for (let i = 0; i < cfg.iterations; i++) {
    const prev = bankroll;
    const res = simulateShooter(cfg, bankroll, logArr);
    bankroll = res.bankroll;
    bankrollHistory.push(bankroll);
    totalRisk += res.risk;
    const diff = bankroll - prev;
    if (diff > 0) {
      wins++;
      winStreak++;
      lossStreak = 0;
      if (winStreak > maxWinStreak) maxWinStreak = winStreak;
    } else if (diff < 0) {
      losses++;
      lossStreak++;
      winStreak = 0;
      if (lossStreak > maxLossStreak) maxLossStreak = lossStreak;
    } else {
      winStreak = 0;
      lossStreak = 0;
    }
  }
  renderChart(bankrollHistory);
  showStats({
    history: bankrollHistory,
    totalRisk,
    wins,
    losses,
    maxWinStreak,
    maxLossStreak,
  });
  logEl.textContent = logArr.slice(0, 100).join("\n");
}

function renderChart(data) {
  const canvas = document.getElementById("bankrollChart");
  if (!canvas) {
    console.error("Canvas element not found");
    return;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("Unable to get 2D context from canvas");
    return;
  }
  if (chart) chart.destroy();

  // simple area fill
  const backgroundFill = "rgba(10,132,255,0.15)";

  // moving average helper
  const windowSize = 50;
  const movingAvg = data.map((_, i, arr) => {
    const start = Math.max(0, i - windowSize + 1);
    const slice = arr.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.map((_, idx) => idx),
      datasets: [
        {
          label: "Bankroll ($)",
          data,
          borderColor: "#0a84ff",
          backgroundColor: backgroundFill,
          tension: 0.1,
          pointRadius: 0,
          fill: true,
        },
        {
          label: `Moving Avg (${windowSize})`,
          data: movingAvg,
          borderColor: "#ff9f0a",
          borderDash: [5, 5],
          pointRadius: 0,
          tension: 0.1,
          fill: false,
        },
      ],
    },
    options: {
      plugins: {
        legend: { position: "bottom" },
        tooltip: { mode: "index", intersect: false },
        zeroline: {}
      },
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          title: {
            display: true,
            text: "Shooter #",
          },
        },
        y: {
          title: {
            display: true,
            text: "Bankroll ($)",
          },
          grid: { color: "rgba(0,0,0,0.05)" },
          zeroLineColor: "#000",
        },
      },
    },
  });
}

// plugin to draw dashed zero line across chart for clear reference
Chart.register({
  id: "zeroline",
  afterDraw(chart) {
    const yScale = chart.scales.y;
    if (!yScale) return;
    const zeroY = yScale.getPixelForValue(0);
    const { ctx, chartArea: { left, right } } = chart;
    ctx.save();
    ctx.strokeStyle = "#888";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(left, zeroY);
    ctx.lineTo(right, zeroY);
    ctx.stroke();
    ctx.restore();
  }
});

function showStats(data) {
  const { history, totalRisk, wins, losses, maxWinStreak, maxLossStreak } = data;
  const final = history[history.length - 1];
  const max = Math.max(...history);
  let min = Math.min(...history);
  // drawdown is peak-to-trough
  let peak = history[0];
  let maxDD = 0;
  history.forEach((v) => {
    if (v > peak) peak = v;
    const dd = peak - v;
    if (dd > maxDD) maxDD = dd;
  });

  const roi = totalRisk ? (final / totalRisk) * 100 : 0;
  const ratio = losses ? (wins / losses).toFixed(2) : "∞";

  statsEl.innerHTML = `
    <h3>Results</h3>
    <p>Final Profit/Loss: <strong>$${final.toFixed(2)}</strong></p>
    <p>Total Wagered: $${totalRisk.toFixed(2)}</p>
    <p>ROI: ${roi.toFixed(2)}% | Win/Loss: ${wins}/${losses} (${ratio})</p>
    <p>Longest Win Streak: ${maxWinStreak} | Longest Loss Streak: ${maxLossStreak}</p>
    <p>Max Profit: $${max.toFixed(2)} | Max Drawdown: $${maxDD.toFixed(2)} | Min: $${min.toFixed(2)}</p>
  `;
}

function updateSentence() {
  const baseBet = parseFloat(baseBetInput.value);
  const reducedBet = parseFloat(reducedBetInput.value);
  const oddsMult = parseFloat(oddsMultInput.value);
  const lowerList = ALL_POINTS.filter((p) => pointStates[p] === "lower").join(", ");
  const oddsList = ALL_POINTS.filter((p) => pointStates[p] === "odds").join(", ");
  sentenceEl.textContent = `Bet $${baseBet} on Do Not Pass each come-out. Odds points: ${oddsList||'—'} (lay ${oddsMult}×). Lower points: ${lowerList||'—'} ($${reducedBet}). Others: keep.`;
}

// update sentence whenever inputs change
[baseBetInput, reducedBetInput, oddsMultInput].forEach((el) =>
  el.addEventListener("input", updateSentence)
);

buildChips(); // rebuild to apply classes
updateSentence();
