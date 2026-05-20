import React, { useMemo, useRef, useState } from "react";
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
  blue: "#7fb7a8",
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const categoryRules = [
  {
    name: "Saúde",
    words: /farmácia|farmacia|remédio|remedio|consulta|médico|medico|exame|saúde|saude|dentista|hospital|clínica|clinica|plano de saúde|plano de saude/i,
  },
  {
    name: "Transporte",
    words: /gasolina|posto|combustível|combustivel|etanol|diesel|uber|99|ônibus|onibus|metrô|metro|transporte|estacionamento|pedágio|pedagio|oficina|carro|moto|pneu|mecânico|mecanico/i,
  },
  {
    name: "Alimentação",
    words: /mercado|supermercado|feira|padaria|açougue|acougue|restaurante|lanche|pizza|delivery|ifood|bebida|sorvete|hambúrguer|hamburguer|comida|almoço|almoco|jantar|café|cafe/i,
  },
  {
    name: "Despesa doméstica",
    words: /aluguel|luz|energia|água|agua|internet|gás|gas|casa|limpeza|produto de limpeza|detergente|sabão|sabao|manutenção|manutencao|condomínio|condominio|iptu|móveis|moveis|eletrodoméstico|eletrodomestico/i,
  },
  {
    name: "Lazer",
    words: /cinema|bar|passeio|viagem|lazer|show|shopping|parque|hobby|festa|hotel|praia|entretenimento/i,
  },
  {
    name: "Profissional",
    words: /trabalho|cliente|ferramenta|material|reunião|reuniao|empresa|profissional|escritório|escritorio|software|assinatura|equipamento/i,
  },
  {
    name: "Educação",
    words: /escola|faculdade|curso|livro|material escolar|educação|educacao|aula|mensalidade|professor/i,
  },
  {
    name: "Pessoal",
    words: /roupa|sapato|cabelo|barbeiro|salão|salao|beleza|presente|perfume|academia|cuidados pessoais/i,
  },
];

function guessCategory(text) {
  const income = isIncome(text);
  if (income) return "Receita";

  const found = categoryRules.find((category) => category.words.test(text));
  return found ? found.name : "Outros";
}

function extractAmount(text) {
  const normalized = text.toLowerCase().replace(",", ".");
  const match = normalized.match(/(\d+(?:\.\d{1,2})?)/);
  return match ? Number(match[1]) : 0;
}

function isIncome(text) {
  return /recebi|ganhei|salário|salario|pix recebido|pagamento|cliente pagou|vendi|entrada/i.test(text);
}

function cleanDescription(text) {
  const cleaned = text
    .replace(/gastei|paguei|comprei|recebi|ganhei|reais|real|r\$/gi, "")
    .replace(/[0-9.,]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^com\s+/i, "")
    .replace(/^no\s+/i, "")
    .replace(/^na\s+/i, "")
    .replace(/^de\s+/i, "");

  if (!cleaned) return "Lançamento";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
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

function getCurrentMonthLabel() {
  return new Date().toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function OrganizemeApp() {
  const [showHome, setShowHome] = useState(true);
  const [entries, setEntries] = useState([]);
  const [message, setMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("Segure o botão e fale seu gasto.");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const recognitionRef = useRef(null);

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

    const categories = Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category,
        amount,
        count: entries.filter((entry) => entry.type === "expense" && entry.category === category).length,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      income,
      expense,
      balance: income - expense,
      categories,
      biggest: categories[0] || null,
      smallest: categories[categories.length - 1] || null,
    };
  }, [entries]);

  const allCategoryNames = [
    "Despesa doméstica",
    "Alimentação",
    "Transporte",
    "Saúde",
    "Educação",
    "Lazer",
    "Profissional",
    "Pessoal",
    "Outros",
  ];

  const categoryDashboard = allCategoryNames.map((category) => {
    const found = summary.categories.find((item) => item.category === category);
    return found || { category, amount: 0, count: 0 };
  });

  const activeCategory = selectedCategory || summary.categories[0]?.category || null;
  const categoryEntries = entries.filter(
    (entry) => entry.type === "expense" && entry.category === activeCategory
  );
  const activeCategoryTotal = categoryEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const maxCategoryAmount = Math.max(...summary.categories.map((item) => item.amount), 1);

  function addFromText(rawText) {
    const text = rawText.trim();
    const amount = extractAmount(text);

    if (!text || amount <= 0) {
      setVoiceStatus("Não encontrei um valor. Exemplo: gastei 50 reais no mercado.");
      return;
    }

    const newEntry = buildEntryFromText(text);
    setEntries((currentEntries) => [newEntry, ...currentEntries]);

    if (newEntry.type === "expense") {
      setSelectedCategory(newEntry.category);
    }

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

    if (!text || amount <= 0) {
      setVoiceStatus("Para salvar, informe um valor. Exemplo: gastei 80 reais com gasolina.");
      return;
    }

    const updatedEntry = buildEntryFromText(text);

    setEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.id === id ? { ...updatedEntry, id: entry.id, date: entry.date } : entry
      )
    );

    setEditingId(null);
    setEditText("");

    if (updatedEntry.type === "expense") {
      setSelectedCategory(updatedEntry.category);
    }
  }

  function startVoiceRecognition() {
    if (isListening) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceStatus("Seu navegador não liberou voz direta. Tente abrir no Safari/Chrome e permitir o microfone.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;

    setIsListening(true);
    setVoiceStatus("Ouvindo... solte o botão para finalizar.");

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setVoiceStatus(`Entendi: “${transcript}”`);
      addFromText(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setVoiceStatus("Não consegui ouvir. Tente novamente falando mais perto do celular.");
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
  }

  function stopVoiceRecognition() {
    if (recognitionRef.current) {
      setVoiceStatus("Finalizando e organizando...");
      recognitionRef.current.stop();
    }
  }

  if (showHome) {
    return (
      <main style={styles.page}>
        <BackgroundGlow />
        <section style={styles.homeScreen}>
          <div style={styles.appIconLarge}>♛</div>
          <p style={styles.goldText}>Organizeme</p>
          <h1 style={styles.homeTitle}>Seu dinheiro organizado por voz.</h1>
          <p style={styles.homeSubtitle}>
            Fale seus gastos como no WhatsApp. O Organizeme organiza categorias, soma valores e mostra para onde seu dinheiro está indo.
          </p>
          <div style={styles.homePreviewCard}>
            <p style={styles.homePreviewText}>“Gastei 120 reais no mercado”</p>
            <div style={styles.chipsRow}>
              <span style={styles.chipGold}>Despesa doméstica</span>
              <span style={styles.chipRed}>-R$ 120,00</span>
            </div>
          </div>
          <button onClick={() => setShowHome(false)} style={styles.startButton}>
            Entrar no Organizeme
          </button>
          <p style={styles.homeHint}>Simples, visual e feito para o uso diário.</p>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <BackgroundGlow />

      <section style={styles.shell}>
        <header style={styles.header}>
          <div style={styles.brandWrap}>
            <div style={styles.logo}>♛</div>
            <div>
              <h1 style={styles.title}>Organizeme</h1>
              <p style={styles.subtitle}>Organização financeira inteligente</p>
            </div>
          </div>
          <div style={styles.badge}>Modo teste</div>
        </header>

        <section style={styles.dashboardCard}>
          <p style={styles.goldText}>Resumo de {getCurrentMonthLabel()}</p>
          <div style={styles.balanceRow}>
            <div>
              <span style={styles.balanceLabel}>Total gasto no mês</span>
              <h2 style={styles.mainNumber}>{money.format(summary.expense)}</h2>
            </div>
            <button style={styles.smallPremiumButton} onClick={() => setShowHome(true)}>
              Início
            </button>
          </div>

          <div style={styles.metricsGridThree}>
            <MetricCard label="Recebido" value={money.format(summary.income)} tone="green" />
            <MetricCard label="Saldo" value={money.format(summary.balance)} tone="gold" />
            <MetricCard label="Lançamentos" value={String(entries.length)} tone="blue" />
          </div>
        </section>

        <div style={styles.grid}>
          <section style={styles.leftColumn}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>Lançar por voz</h3>
                  <p style={styles.smallText}>Segure o botão, fale e solte para organizar.</p>
                </div>
                <span style={styles.icon}>🎙️</span>
              </div>

              <div style={styles.chatBox}>
                <div style={styles.inputRow}>
                  <input
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") addFromText(message);
                    }}
                    placeholder="Ex: gastei 50 reais com gasolina"
                    style={styles.input}
                  />
                  <button onClick={() => addFromText(message)} style={styles.sendButton}>
                    ➤
                  </button>
                </div>

                <button
                  onMouseDown={startVoiceRecognition}
                  onMouseUp={stopVoiceRecognition}
                  onMouseLeave={stopVoiceRecognition}
                  onTouchStart={(event) => {
                    event.preventDefault();
                    startVoiceRecognition();
                  }}
                  onTouchEnd={(event) => {
                    event.preventDefault();
                    stopVoiceRecognition();
                  }}
                  style={isListening ? { ...styles.voiceButton, ...styles.voiceButtonActive } : styles.voiceButton}
                >
                  🎤 {isListening ? "Solte para finalizar" : "Segure para falar"}
                </button>
                <p style={styles.voiceStatus}>{voiceStatus}</p>
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>Histórico de lançamentos</h3>
                  <p style={styles.smallText}>Todos os registros ficam editáveis.</p>
                </div>
                <span style={styles.icon}>🧾</span>
              </div>

              <div style={styles.messages}>
                {entries.length === 0 && (
                  <div style={styles.emptyState}>
                    Nenhum lançamento ainda. Experimente falar: “gastei 50 reais no mercado”.
                  </div>
                )}

                {entries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    editingId={editingId}
                    editText={editText}
                    setEditText={setEditText}
                    saveEdit={saveEdit}
                    cancelEdit={() => setEditingId(null)}
                    startEditing={startEditing}
                    deleteEntry={deleteEntry}
                  />
                ))}
              </div>
            </div>
          </section>

          <section style={styles.rightColumn}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>Dashboard por categoria</h3>
                  <p style={styles.smallText}>Clique em uma categoria para ver tudo que foi gasto.</p>
                </div>
                <span style={styles.icon}>📊</span>
              </div>

              <div style={styles.insightGrid}>
                <InsightCard
                  title="Maior despesa"
                  value={summary.biggest?.category || "Sem dados"}
                  amount={summary.biggest ? money.format(summary.biggest.amount) : money.format(0)}
                  danger
                />
                <InsightCard
                  title="Categoria mais controlada"
                  value={summary.smallest?.category || "Sem dados"}
                  amount={summary.smallest ? money.format(summary.smallest.amount) : money.format(0)}
                />
              </div>

              <div style={styles.categoryList}>
                {entries.length === 0 && (
                  <div style={styles.emptyState}>As categorias aparecerão aqui. Toque em uma categoria para ver os detalhes.</div>
                )}

                {categoryDashboard.map((item) => {
                  const percent = item.amount > 0 ? Math.max((item.amount / maxCategoryAmount) * 100, 7) : 0;
                  const isActive = activeCategory === item.category;
                  const barColor = percent > 75 ? BRAND.red : percent > 45 ? BRAND.gold : BRAND.success;

                  return (
                    <button
                      key={item.category}
                      onClick={() => setSelectedCategory(item.category)}
                      style={isActive ? { ...styles.categoryButton, ...styles.categoryButtonActive } : styles.categoryButton}
                    >
                      <div style={styles.categoryTopLine}>
                        <strong>{item.category}</strong>
                        <span>{money.format(item.amount)}</span>
                      </div>
                      <div style={styles.barTrack}>
                        <div style={{ ...styles.barFill, width: `${percent}%`, background: barColor }} />
                      </div>
                      <small style={styles.categorySmall}>{item.count} lançamento(s)</small>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>{activeCategory || "Detalhes da categoria"}</h3>
                  <p style={styles.smallText}>Veja data, descrição, valor e edite quando precisar.</p>
                </div>
                <span style={styles.totalPill}>{money.format(activeCategoryTotal)}</span>
              </div>

              <div style={styles.detailsList}>
                {categoryEntries.length === 0 && (
                  <div style={styles.emptyState}>Nenhum gasto nessa categoria ainda.</div>
                )}

                {categoryEntries.map((entry) => (
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

            <div style={styles.assistantCard}>
              <p style={styles.goldText}>Assistente Organizeme</p>
              <h3 style={styles.assistantTitle}>
                {summary.biggest
                  ? `Sua maior despesa foi em ${summary.biggest.category}.`
                  : "Comece lançando seu primeiro gasto."}
              </h3>
              <p style={styles.smallText}>
                Tudo que você registrar será somado automaticamente no dashboard principal e separado por categoria.
              </p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function BackgroundGlow() {
  return (
    <>
      <div style={styles.glowOne} />
      <div style={styles.glowTwo} />
    </>
  );
}

function MetricCard({ label, value, tone }) {
  const toneColor = tone === "green" ? BRAND.success : tone === "blue" ? BRAND.blue : BRAND.lightGold;

  return (
    <div style={styles.metricCard}>
      <p style={styles.smallText}>{label}</p>
      <strong style={{ color: toneColor, fontSize: 22 }}>{value}</strong>
    </div>
  );
}

function InsightCard({ title, value, amount, danger }) {
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

function EntryCard({
  entry,
  editingId,
  editText,
  setEditText,
  saveEdit,
  cancelEdit,
  startEditing,
  deleteEntry,
}) {
  const editing = editingId === entry.id;

  return (
    <div style={styles.messageBubble}>
      {editing ? (
        <div>
          <input
            value={editText}
            onChange={(event) => setEditText(event.target.value)}
            style={styles.editInput}
          />
          <div style={styles.actionRow}>
            <button onClick={() => saveEdit(entry.id)} style={styles.smallGoldButton}>Salvar</button>
            <button onClick={cancelEdit} style={styles.smallGhostButton}>Cancelar</button>
          </div>
        </div>
      ) : (
        <>
          <p style={styles.messageText}>“{entry.text}”</p>
          <div style={styles.chipsRow}>
            <span style={styles.chipGold}>{entry.category}</span>
            <span style={entry.type === "income" ? styles.chipGreen : styles.chipRed}>
              {entry.type === "income" ? "+" : "-"}{money.format(entry.amount)}
            </span>
          </div>
          <div style={styles.actionRow}>
            <button onClick={() => startEditing(entry)} style={styles.smallGhostButton}>Editar</button>
            <button onClick={() => deleteEntry(entry.id)} style={styles.smallDangerButton}>Apagar</button>
          </div>
        </>
      )}
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
    background: "rgba(44,103,88,.48)",
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
  shell: { position: "relative", maxWidth: 1160, margin: "0 auto", padding: "14px", boxSizing: "border-box" }
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12 },
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
    border: "1px solid rgba(240,221,154,.25)",
    background: "rgba(24,61,53,.85)",
    borderRadius: 999,
    padding: "9px 13px",
    color: BRAND.cream,
    fontSize: 13,
  },
  dashboardCard: {
    border: "1px solid rgba(240,221,154,.22)",
    borderRadius: 28,
    background: `linear-gradient(135deg, ${BRAND.softGreen}, ${BRAND.mainGreen}, ${BRAND.cardGreen})`,
    padding: 18,
    boxShadow: "0 28px 80px rgba(0,0,0,.18)",
    marginBottom: 18,
    overflow: "hidden",
  },
  balanceRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginTop: 12 },
  balanceLabel: { color: BRAND.mutedGold, fontSize: 13 },
  mainNumber: { fontSize: "clamp(42px, 13vw, 64px)", lineHeight: 1, margin: "8px 0 0", color: BRAND.cream, letterSpacing: -1.5 }
  smallPremiumButton: {
    border: "1px solid rgba(240,221,154,.3)",
    background: "rgba(18,53,46,.38)",
    color: BRAND.lightGold,
    borderRadius: 999,
    padding: "9px 13px",
    cursor: "pointer",
  },
  metricsGridThree: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginTop: 20 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }
  leftColumn: { display: "grid", gap: 20, alignContent: "start" },
  rightColumn: { display: "grid", gap: 20, alignContent: "start" },
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
  goldText: { color: BRAND.lightGold, margin: 0, fontSize: 14 },
  smallText: { margin: 0, color: BRAND.mutedGold, fontSize: 13, lineHeight: 1.5 },
  metricCard: {
    border: "1px solid rgba(240,221,154,.17)",
    background: "rgba(24,61,53,.72)",
    borderRadius: 20,
    padding: 12,
    minWidth: 0,
    overflow: "hidden",
  },
  chatBox: { border: "1px solid rgba(240,221,154,.16)", background: "rgba(31,75,64,.86)", borderRadius: 24, padding: 12 },
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
    boxSizing: "border-box",
    minWidth: 0,
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
    minHeight: 64,
    border: "1px solid rgba(240,221,154,.33)",
    borderRadius: 24,
    background: `linear-gradient(90deg, ${BRAND.lightGold}, ${BRAND.gold}, #9f7d39)`,
    color: BRAND.deepGreen,
    fontWeight: 900,
    fontSize: 17,
    cursor: "pointer",
    boxShadow: "0 0 45px rgba(198,161,91,.25)",
    userSelect: "none",
    WebkitUserSelect: "none",
    touchAction: "none",
  },
  voiceButtonActive: {
    transform: "scale(0.98)",
    background: `linear-gradient(90deg, ${BRAND.gold}, ${BRAND.lightGold}, ${BRAND.gold})`,
    boxShadow: "0 0 70px rgba(240,221,154,.45)",
  },
  voiceStatus: { margin: "10px 0 0", color: BRAND.mutedGold, fontSize: 12, textAlign: "center" },
  messages: { display: "grid", gap: 10, maxHeight: 460, overflow: "auto" },
  messageBubble: { background: "rgba(44,103,88,.83)", borderRadius: 20, padding: 13 },
  messageText: { margin: 0, fontSize: 14 },
  chipsRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 9 },
  chipGold: { borderRadius: 999, background: "rgba(24,61,53,.88)", color: BRAND.lightGold, padding: "5px 8px", fontSize: 12 },
  chipGreen: { borderRadius: 999, background: "rgba(117,197,138,.18)", color: "#b9f5c6", padding: "5px 8px", fontSize: 12 },
  chipRed: { borderRadius: 999, background: "rgba(185,85,76,.18)", color: "#ffd1cd", padding: "5px 8px", fontSize: 12 },
  actionRow: { display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" },
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
  insightGrid: { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" },
  insightCard: { border: "1px solid", borderRadius: 24, padding: 16, background: "rgba(44,103,88,.34)" },
  insightFooter: { display: "flex", alignItems: "end", justifyContent: "space-between", gap: 12, marginTop: 8 },
  categoryList: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 16 }
  categoryButton: {
    border: "1px solid rgba(240,221,154,.16)",
    background: "rgba(31,75,64,.72)",
    color: BRAND.cream,
    borderRadius: 20,
    padding: 12,
    cursor: "pointer",
    textAlign: "left",
    minWidth: 0,
  }
  categoryButtonActive: {
    border: "1px solid rgba(240,221,154,.45)",
    background: "rgba(198,161,91,.16)",
  },
  categoryTopLine: { display: "grid", gap: 6, alignItems: "center", marginBottom: 9 }
  categorySmall: { color: BRAND.mutedGold, display: "block", marginTop: 8 },
  barTrack: { height: 12, background: "rgba(18,53,46,.86)", borderRadius: 999, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 999 },
  detailsList: { display: "grid", gap: 9 },
  detailItem: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "rgba(44,103,88,.44)", borderRadius: 18, padding: 12 },
  detailTitle: { margin: 0, color: BRAND.cream, fontWeight: 700, fontSize: 14 },
  redText: { color: "#ffd1cd", whiteSpace: "nowrap" },
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
  totalPill: { borderRadius: 999, background: "rgba(198,161,91,.18)", color: BRAND.lightGold, padding: "7px 11px", fontSize: 13 },
  emptyState: {
    border: "1px dashed rgba(240,221,154,.25)",
    borderRadius: 20,
    padding: 18,
    color: BRAND.mutedGold,
    textAlign: "center",
    fontSize: 14,
  },
  assistantCard: {
    border: "1px solid rgba(240,221,154,.22)",
    borderRadius: 32,
    background: `linear-gradient(135deg, ${BRAND.softGreen}, ${BRAND.cardGreen})`,
    padding: 20,
  },
  assistantTitle: { margin: "8px 0", color: BRAND.cream, fontSize: 24 },
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
  homePreviewText: { margin: 0, fontSize: 17, color: BRAND.cream },
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
  homeHint: { marginTop: 14, color: BRAND.mutedGold, fontSize: 13 },
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <OrganizemeApp />
  </React.StrictMode>
);
