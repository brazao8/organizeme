import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom/client";

const BRAND = {
  deepGreen: "#12352e",
  mainGreen: "#1f4b40",
  softGreen: "#2c6758",
  cardGreen: "#183d35",
  gold: "#c6a15b",
  lightGold: "#f0dd9a",
  cream: "#f8f1d5",
  mutedGold: "#d8c993",
  red: "#b9554c",
  success: "#75c58a",
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const starterEntries = [];

function guessCategory(text) {
  const lower = text.toLowerCase();

  if (/sal[aá]rio|recebi|ganhei|pix recebido|pagamento|cliente/.test(lower)) return "Receitas";
  if (/mercado|supermercado|aluguel|luz|energia|[aá]gua|internet|g[áa]s|casa|feira/.test(lower)) return "Despesas Domésticas";
  if (/gasolina|posto|uber|99|ônibus|onibus|metr[oô]|transporte|estacionamento/.test(lower)) return "Transporte";
  if (/cinema|restaurante|bar|passeio|viagem|lazer|show|pizza|lanche/.test(lower)) return "Lazer";
  if (/trabalho|cliente|ferramenta|material|reuni[aã]o|empresa|profissional/.test(lower)) return "Profissional";
  if (/rem[eé]dio|consulta|m[eé]dico|exame|farm[aá]cia|sa[uú]de/.test(lower)) return "Saúde";

  return "Outros";
}

function extractAmount(text) {
  const normalized = text.toLowerCase().replace(",", ".");
  const match = normalized.match(/(\d+(?:\.\d{1,2})?)/);
  return match ? Number(match[1]) : 0;
}

function isIncome(text) {
  return /recebi|ganhei|sal[aá]rio|pix recebido|pagamento|cliente/.test(text.toLowerCase());
}

function cleanDescription(text) {
  const cleaned = text
    .replace(/gastei|paguei|comprei|recebi|ganhei|reais|real|r\$/gi, "")
    .replace(/[0-9.,]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^com\s+/i, "")
    .replace(/^no\s+/i, "")
    .replace(/^na\s+/i, "");

  return cleaned || "Lançamento";
}

function buildEntryFromText(text) {
  const amount = extractAmount(text);
  const type = isIncome(text) ? "income" : "expense";

  return {
    id: Date.now(),
    text,
    type,
    description: cleanDescription(text),
    category: guessCategory(text),
    amount,
    date: new Date().toISOString().slice(0, 10),
  };
}

function OrganizemeApp() {
  const [showHome, setShowHome] = useState(true);
  const [entries, setEntries] = useState(starterEntries);
  const [message, setMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("Toque no botão e fale seu gasto.");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Despesas Domésticas");

  const summary = useMemo(() => {
    const income = entries
      .filter((entry) => entry.type === "income")
      .reduce((sum, entry) => sum + entry.amount, 0);

    const expense = entries
      .filter((entry) => entry.type === "expense")
      .reduce((sum, entry) => sum + entry.amount, 0);

    const categoryTotals = entries
      .filter((entry) => entry.type === "expense")
      .reduce((acc, entry) => {
        acc[entry.category] = (acc[entry.category] || 0) + entry.amount;
        return acc;
      }, {});

    const chart = Object.entries(categoryTotals)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    return {
      income,
      expense,
      balance: income - expense,
      chart,
      biggest: chart[0] || { category: "Nenhuma", amount: 0 },
      smallest: chart[chart.length - 1] || { category: "Nenhuma", amount: 0 },
    };
  }, [entries]);

  const selectedEntries = entries.filter(
    (entry) => entry.type === "expense" && entry.category === selectedCategory
  );

  const selectedTotal = selectedEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const maxAmount = Math.max(...summary.chart.map((item) => item.amount), 1);

  function addFromText(rawText) {
    const text = rawText.trim();
    const amount = extractAmount(text);

    if (!text || amount <= 0) return;

    const newEntry = buildEntryFromText(text);
    setEntries((currentEntries) => [newEntry, ...currentEntries]);
    if (newEntry.type === "expense") setSelectedCategory(newEntry.category);
    setMessage("");
    setVoiceStatus("Lançamento adicionado com sucesso.");
  }

  function deleteEntry(id) {
    setEntries((currentEntries) => currentEntries.filter((entry) => entry.id !== id));
  }

  function startEditing(entry) {
    setEditingId(entry.id);
    setEditText(entry.text);
  }

  function saveEdit(id) {
    const text = editText.trim();
    const amount = extractAmount(text);

    if (!text || amount <= 0) return;

    const updatedEntry = buildEntryFromText(text);

    setEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.id === id ? { ...updatedEntry, id: entry.id, date: entry.date } : entry
      )
    );

    setEditingId(null);
    setEditText("");
    if (updatedEntry.type === "expense") setSelectedCategory(updatedEntry.category);
  }

  function startVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceStatus("Seu navegador não liberou voz direta. No iPhone, toque no campo de texto e use o microfone do teclado.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;

    setIsListening(true);
    setVoiceStatus("Ouvindo... fale agora.");

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setVoiceStatus(`Entendi: “${transcript}”`);
      addFromText(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setVoiceStatus("Não consegui ouvir. No iPhone, use o microfone do teclado dentro do campo de texto.");
    };

    recognition.onend = () => setIsListening(false);
    recognition.start();
  }

  if (showHome) {
    return (
      <main style={styles.page}>
        <div style={styles.glowOne} />
        <div style={styles.glowTwo} />

        <section style={styles.homeScreen}>
          <div style={styles.appIconLarge}>♛</div>
          <p style={styles.goldText}>Organizeme</p>
          <h1 style={styles.homeTitle}>Seu dinheiro organizado por voz.</h1>
          <p style={styles.homeSubtitle}>
            Fale seus gastos como no WhatsApp. O app organiza, separa categorias e mostra onde seu dinheiro está indo.
          </p>

          <div style={styles.homePreviewCard}>
            <p style={styles.homePreviewText}>“Gastei 120 reais no mercado”</p>
            <div style={styles.chipsRow}>
              <span style={styles.chipGold}>Despesas Domésticas</span>
              <span style={styles.chipRed}>-R$ 120,00</span>
            </div>
          </div>

          <button onClick={() => setShowHome(false)} style={styles.startButton}>
            Entrar no Organizeme
          </button>

          <p style={styles.homeHint}>Toque uma vez e comece a organizar sua vida financeira.</p>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.glowOne} />
      <div style={styles.glowTwo} />

      <section style={styles.shell}>
        <header style={styles.header}>
          <div style={styles.brandWrap}>
            <div style={styles.logo}>♛</div>
            <div>
              <h1 style={styles.title}>Organizeme</h1>
              <p style={styles.subtitle}>Organização financeira inteligente</p>
            </div>
          </div>
          <div style={styles.badge}>Experiência Premium</div>
        </header>

        <div style={styles.grid}>
          <section style={styles.leftColumn}>
            <div style={styles.heroCard}>
              <p style={styles.goldText}>✨ Resumo do mês</p>
              <h2 style={styles.balance}>{money.format(summary.balance)}</h2>
              <p style={styles.smallText}>Saldo estimado depois dos gastos do mês</p>

              <div style={styles.metricsGrid}>
                <Metric title="Entradas" value={money.format(summary.income)} positive />
                <Metric title="Gastos" value={money.format(summary.expense)} />
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>Fale como no WhatsApp</h3>
                  <p style={styles.smallText}>Digite ou toque no microfone. O app organiza sozinho.</p>
                </div>
                <span style={styles.icon}>🎙️</span>
              </div>

              <div style={styles.chatBox}>
                <div style={styles.messages}>
                  {entries.length === 0 && (
                    <div style={styles.emptyState}>
                      Nenhum lançamento ainda. Digite ou fale: “gastei 50 reais no mercado”.
                    </div>
                  )}
                  {entries.slice(0, 6).map((entry) => (
                    <div key={entry.id} style={styles.messageBubble}>
                      {editingId === entry.id ? (
                        <div>
                          <input
                            value={editText}
                            onChange={(event) => setEditText(event.target.value)}
                            style={styles.editInput}
                          />
                          <div style={styles.actionRow}>
                            <button onClick={() => saveEdit(entry.id)} style={styles.smallGoldButton}>Salvar</button>
                            <button onClick={() => setEditingId(null)} style={styles.smallGhostButton}>Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p style={styles.messageText}>“{entry.text}”</p>
                          <div style={styles.chipsRow}>
                            <span style={styles.chipGold}>{entry.category}</span>
                            <span style={entry.type === "income" ? styles.chipGreen : styles.chipRed}>
                              {entry.type === "income" ? "+" : "-"}
                              {money.format(entry.amount)}
                            </span>
                          </div>
                          <div style={styles.actionRow}>
                            <button onClick={() => startEditing(entry)} style={styles.smallGhostButton}>Editar</button>
                            <button onClick={() => deleteEntry(entry.id)} style={styles.smallDangerButton}>Apagar</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <div style={styles.inputRow}>
                  <input
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") addFromText(message);
                    }}
                    placeholder="Ex: gastei 120 reais no mercado"
                    style={styles.input}
                  />
                  <button onClick={() => addFromText(message)} style={styles.sendButton}>
                    ➤
                  </button>
                </div>

                <button onClick={startVoiceRecognition} style={styles.voiceButton}>
                  🎤 {isListening ? "Ouvindo..." : "Toque e fale"}
                </button>
                <p style={styles.voiceStatus}>{voiceStatus}</p>
              </div>
            </div>
          </section>

          <section style={styles.rightColumn}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>Inteligência do mês</h3>
                  <p style={styles.smallText}>Análise simples, direta e visual.</p>
                </div>
                <span style={styles.icon}>📊</span>
              </div>

              <div style={styles.insightGrid}>
                <Insight title="Categoria que mais gastou" value={summary.biggest.category} amount={money.format(summary.biggest.amount)} danger />
                <Insight title="Categoria mais econômica" value={summary.smallest.category} amount={money.format(summary.smallest.amount)} />
              </div>

              <div style={styles.chartCard}>
                <p style={styles.sectionTitle}>Gastos por categoria</p>
                <div style={styles.barsWrap}>
                  {summary.chart.length === 0 && (
                    <div style={styles.emptyState}>
                      O gráfico aparecerá depois do seu primeiro gasto.
                    </div>
                  )}
                  {summary.chart.map((item) => {
                    const percent = Math.max((item.amount / maxAmount) * 100, 8);
                    const barColor = percent > 75 ? BRAND.red : percent > 45 ? BRAND.gold : BRAND.success;
                    return (
                      <button
                        key={item.category}
                        onClick={() => setSelectedCategory(item.category)}
                        style={styles.barButton}
                      >
                        <span style={styles.barLabel}>{item.category}</span>
                        <div style={styles.barTrack}>
                          <div style={{ ...styles.barFill, width: `${percent}%`, background: barColor }} />
                        </div>
                        <span style={styles.barValue}>{money.format(item.amount)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={styles.detailsCard}>
                <div style={styles.detailsHeader}>
                  <div>
                    <p style={styles.smallText}>Detalhes da categoria</p>
                    <h4 style={styles.cardTitle}>{selectedCategory}</h4>
                  </div>
                  <span style={styles.totalPill}>{money.format(selectedTotal)}</span>
                </div>

                <div style={styles.detailsList}>
                  {selectedEntries.length === 0 && (
                    <div style={styles.emptyState}>
                      Nenhum gasto nessa categoria ainda.
                    </div>
                  )}
                  {selectedEntries.map((entry) => (
                    <div key={entry.id} style={styles.detailItem}>
                      <div>
                        <p style={styles.detailTitle}>{entry.description}</p>
                        <p style={styles.smallText}>{new Date(entry.date).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <div style={styles.detailActions}>
                        <strong style={styles.redText}>-{money.format(entry.amount)}</strong>
                        <button onClick={() => startEditing(entry)} style={styles.tinyButton}>Editar</button>
                        <button onClick={() => deleteEntry(entry.id)} style={styles.tinyDangerButton}>Apagar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={styles.assistantCard}>
              <p style={styles.goldText}>Assistente Organizeme</p>
              <h3 style={styles.assistantTitle}>Sua maior despesa foi em {summary.biggest.category}.</h3>
              <p style={styles.smallText}>
                A categoria mais controlada foi {summary.smallest.category}. O Organizeme está aprendendo seus hábitos financeiros para tornar sua vida mais organizada e simples.
              </p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function Metric({ title, value, positive }) {
  return (
    <div style={styles.metricCard}>
      <p style={styles.smallText}>{title}</p>
      <strong style={{ color: positive ? BRAND.success : "#ffd1cd", fontSize: 22 }}>{value}</strong>
    </div>
  );
}

function Insight({ title, value, amount, danger }) {
  return (
    <div style={{ ...styles.insightCard, borderColor: danger ? "rgba(185,85,76,.45)" : "rgba(117,197,138,.45)" }}>
      <p style={styles.smallText}>{title}</p>
      <div style={styles.insightFooter}>
        <strong>{value}</strong>
        <span style={{ color: danger ? "#ffd1cd" : "#b9f5c6" }}>{amount}</span>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: BRAND.deepGreen,
    color: BRAND.cream,
    fontFamily: "Inter, Arial, sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  glowOne: {
    position: "fixed",
    width: 460,
    height: 460,
    borderRadius: "50%",
    background: "rgba(44,103,88,.45)",
    filter: "blur(90px)",
    top: -120,
    left: "35%",
  },
  glowTwo: {
    position: "fixed",
    width: 420,
    height: 420,
    borderRadius: "50%",
    background: "rgba(198,161,91,.18)",
    filter: "blur(90px)",
    bottom: -120,
    right: -80,
  },
  shell: { position: "relative", maxWidth: 1120, margin: "0 auto", padding: 18 },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 12 },
  brandWrap: { display: "flex", alignItems: "center", gap: 12 },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 18,
    display: "grid",
    placeItems: "center",
    background: `linear-gradient(135deg, ${BRAND.lightGold}, ${BRAND.gold})`,
    color: BRAND.deepGreen,
    fontSize: 27,
    boxShadow: "0 0 40px rgba(198,161,91,.25)",
  },
  title: { margin: 0, fontSize: 24, letterSpacing: 1 },
  subtitle: { margin: "3px 0 0", color: BRAND.mutedGold, fontSize: 12 },
  badge: {
    display: "none",
    border: "1px solid rgba(240,221,154,.25)",
    background: "rgba(24,61,53,.85)",
    borderRadius: 999,
    padding: "10px 14px",
    color: BRAND.cream,
    fontSize: 14,
  },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 },
  leftColumn: { display: "grid", gap: 20 },
  rightColumn: { display: "grid", gap: 20 },
  heroCard: {
    border: "1px solid rgba(240,221,154,.22)",
    borderRadius: 32,
    background: `linear-gradient(135deg, ${BRAND.softGreen}, ${BRAND.mainGreen}, ${BRAND.cardGreen})`,
    padding: 22,
    boxShadow: "0 28px 80px rgba(0,0,0,.18)",
  },
  goldText: { color: BRAND.lightGold, margin: 0, fontSize: 14 },
  balance: { fontSize: "clamp(38px, 7vw, 64px)", lineHeight: 1, margin: "16px 0 8px", color: BRAND.cream },
  smallText: { margin: 0, color: BRAND.mutedGold, fontSize: 13, lineHeight: 1.5 },
  metricsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 22 },
  metricCard: {
    border: "1px solid rgba(240,221,154,.17)",
    background: "rgba(24,61,53,.72)",
    borderRadius: 24,
    padding: 16,
  },
  card: {
    border: "1px solid rgba(240,221,154,.17)",
    background: "rgba(24,61,53,.96)",
    borderRadius: 32,
    padding: 20,
    boxShadow: "0 28px 80px rgba(0,0,0,.16)",
  },
  cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 },
  cardTitle: { margin: 0, color: BRAND.cream, fontSize: 19 },
  icon: { fontSize: 22 },
  chatBox: { border: "1px solid rgba(240,221,154,.16)", background: "rgba(31,75,64,.86)", borderRadius: 24, padding: 12 },
  messages: { display: "grid", gap: 10, maxHeight: 300, overflow: "auto", marginBottom: 12 },
  messageBubble: { background: "rgba(44,103,88,.83)", borderRadius: 20, padding: 13 },
  messageText: { margin: 0, fontSize: 14 },
  chipsRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 9 },
  chipGold: { borderRadius: 999, background: "rgba(24,61,53,.88)", color: BRAND.lightGold, padding: "5px 8px", fontSize: 12 },
  chipGreen: { borderRadius: 999, background: "rgba(117,197,138,.18)", color: "#b9f5c6", padding: "5px 8px", fontSize: 12 },
  chipRed: { borderRadius: 999, background: "rgba(185,85,76,.18)", color: "#ffd1cd", padding: "5px 8px", fontSize: 12 },
  inputRow: { display: "flex", gap: 8 },
  input: {
    flex: 1,
    height: 48,
    borderRadius: 18,
    border: "1px solid rgba(240,221,154,.22)",
    background: "rgba(18,53,46,.82)",
    color: BRAND.cream,
    padding: "0 14px",
    outline: "none",
  },
  sendButton: {
    width: 52,
    border: "none",
    borderRadius: 18,
    background: BRAND.gold,
    color: BRAND.deepGreen,
    fontWeight: 900,
    cursor: "pointer",
  },
  voiceButton: {
    marginTop: 12,
    width: "100%",
    minHeight: 62,
    border: "1px solid rgba(240,221,154,.33)",
    borderRadius: 24,
    background: `linear-gradient(90deg, ${BRAND.lightGold}, ${BRAND.gold}, #9f7d39)`,
    color: BRAND.deepGreen,
    fontWeight: 900,
    fontSize: 17,
    cursor: "pointer",
    boxShadow: "0 0 45px rgba(198,161,91,.25)",
  },
  insightGrid: { display: "grid", gap: 12 },
  insightCard: { border: "1px solid", borderRadius: 24, padding: 16, background: "rgba(44,103,88,.34)" },
  insightFooter: { display: "flex", alignItems: "end", justifyContent: "space-between", gap: 12, marginTop: 8 },
  chartCard: { marginTop: 18, border: "1px solid rgba(240,221,154,.16)", background: "rgba(31,75,64,.86)", borderRadius: 24, padding: 14 },
  sectionTitle: { margin: "0 0 14px", fontWeight: 700 },
  barsWrap: { display: "grid", gap: 12 },
  barButton: { display: "grid", gridTemplateColumns: "120px 1fr auto", alignItems: "center", gap: 10, background: "transparent", border: 0, color: BRAND.cream, cursor: "pointer", padding: 0, textAlign: "left" },
  barLabel: { fontSize: 12, color: BRAND.cream },
  barTrack: { height: 18, background: "rgba(18,53,46,.86)", borderRadius: 999, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 999 },
  barValue: { fontSize: 12, color: BRAND.mutedGold },
  detailsCard: { marginTop: 16, border: "1px solid rgba(240,221,154,.16)", background: "rgba(18,53,46,.86)", borderRadius: 24, padding: 14 },
  detailsHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  totalPill: { borderRadius: 999, background: "rgba(198,161,91,.18)", color: BRAND.lightGold, padding: "7px 11px", fontSize: 13 },
  detailsList: { display: "grid", gap: 9 },
  emptyState: {
    border: "1px dashed rgba(240,221,154,.25)",
    borderRadius: 20,
    padding: 18,
    color: BRAND.mutedGold,
    textAlign: "center",
    fontSize: 14,
  },
  detailItem: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "rgba(44,103,88,.44)", borderRadius: 18, padding: 12 },
  detailTitle: { margin: 0, color: BRAND.cream, fontWeight: 700, fontSize: 14 },
  redText: { color: "#ffd1cd", whiteSpace: "nowrap" },
  assistantCard: {
    border: "1px solid rgba(240,221,154,.22)",
    borderRadius: 32,
    background: `linear-gradient(135deg, ${BRAND.softGreen}, ${BRAND.cardGreen})`,
    padding: 20,
  },
  voiceStatus: { margin: "10px 0 0", color: BRAND.mutedGold, fontSize: 12, textAlign: "center" },
  editInput: {
    width: "100%",
    height: 44,
    borderRadius: 16,
    border: "1px solid rgba(240,221,154,.25)",
    background: "rgba(18,53,46,.88)",
    color: BRAND.cream,
    padding: "0 12px",
    outline: "none",
    boxSizing: "border-box",
  },
  actionRow: { display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" },
  smallGoldButton: {
    border: 0,
    borderRadius: 999,
    background: BRAND.gold,
    color: BRAND.deepGreen,
    padding: "7px 12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  smallGhostButton: {
    border: "1px solid rgba(240,221,154,.22)",
    borderRadius: 999,
    background: "rgba(18,53,46,.45)",
    color: BRAND.cream,
    padding: "7px 12px",
    cursor: "pointer",
  },
  smallDangerButton: {
    border: "1px solid rgba(185,85,76,.38)",
    borderRadius: 999,
    background: "rgba(185,85,76,.16)",
    color: "#ffd1cd",
    padding: "7px 12px",
    cursor: "pointer",
  },
  detailActions: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  tinyButton: {
    border: "1px solid rgba(240,221,154,.22)",
    borderRadius: 999,
    background: "rgba(18,53,46,.45)",
    color: BRAND.cream,
    padding: "5px 8px",
    fontSize: 11,
    cursor: "pointer",
  },
  tinyDangerButton: {
    border: "1px solid rgba(185,85,76,.38)",
    borderRadius: 999,
    background: "rgba(185,85,76,.16)",
    color: "#ffd1cd",
    padding: "5px 8px",
    fontSize: 11,
    cursor: "pointer",
  },
  assistantTitle: { margin: "8px 0", color: BRAND.cream, fontSize: 25 },
  homeScreen: {
    minHeight: "100vh",
    maxWidth: 520,
    margin: "0 auto",
    padding: "42px 22px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    position: "relative",
  },
  appIconLarge: {
    width: 118,
    height: 118,
    borderRadius: 34,
    display: "grid",
    placeItems: "center",
    background: `linear-gradient(135deg, ${BRAND.lightGold}, ${BRAND.gold}, #9f7d39)`,
    color: BRAND.deepGreen,
    fontSize: 64,
    boxShadow: "0 0 70px rgba(198,161,91,.34)",
    marginBottom: 22,
  },
  homeTitle: {
    margin: "10px 0 12px",
    fontSize: "clamp(38px, 10vw, 58px)",
    lineHeight: 1,
    color: BRAND.cream,
    letterSpacing: -1.5,
  },
  homeSubtitle: {
    margin: 0,
    color: BRAND.mutedGold,
    fontSize: 16,
    lineHeight: 1.6,
    maxWidth: 460,
  },
  homePreviewCard: {
    width: "100%",
    marginTop: 28,
    border: "1px solid rgba(240,221,154,.18)",
    background: "rgba(24,61,53,.92)",
    borderRadius: 28,
    padding: 18,
    boxShadow: "0 28px 80px rgba(0,0,0,.18)",
    textAlign: "left",
  },
  homePreviewText: {
    margin: 0,
    fontSize: 17,
    color: BRAND.cream,
  },
  startButton: {
    width: "100%",
    minHeight: 64,
    marginTop: 24,
    border: "1px solid rgba(240,221,154,.35)",
    borderRadius: 24,
    background: `linear-gradient(90deg, ${BRAND.lightGold}, ${BRAND.gold}, #9f7d39)`,
    color: BRAND.deepGreen,
    fontWeight: 900,
    fontSize: 17,
    cursor: "pointer",
    boxShadow: "0 0 45px rgba(198,161,91,.25)",
  },
  homeHint: {
    marginTop: 14,
    color: BRAND.mutedGold,
    fontSize: 13,
  },
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <OrganizemeApp />
  </React.StrictMode>
);
