import React, { useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";

const BRAND = {
  bg: "#12352e",
  card: "#183d35",
  card2: "#1f4b40",
  green: "#2c6758",
  gold: "#c6a15b",
  gold2: "#f0dd9a",
  cream: "#f8f1d5",
  muted: "#d8c993",
  red: "#ff6b6b",
  success: "#75c58a",
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const CATEGORIES = [
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

function isIncome(text) {
  return /recebi|ganhei|sal[aá]rio|pagamento|pix recebido|cliente pagou|vendi|entrada/i.test(text);
}

function getCategory(text) {
  if (isIncome(text)) return "Receita";

  if (/farm[aá]cia|rem[eé]dio|consulta|m[eé]dico|exame|dentista|hospital|sa[uú]de/i.test(text)) return "Saúde";

  if (/gasolina|posto|combust[ií]vel|uber|99|[oô]nibus|metr[oô]|carro|moto|estacionamento|ped[aá]gio/i.test(text)) return "Transporte";

  if (/mercado|supermercado|feira|padaria|açougue|restaurante|lanche|pizza|ifood|delivery|comida|almo[cç]o|jantar/i.test(text)) return "Alimentação";

  if (/aluguel|luz|energia|[aá]gua|internet|g[aá]s|limpeza|condom[ií]nio|iptu|casa|manuten[cç][aã]o/i.test(text)) return "Despesa doméstica";

  if (/cinema|bar|passeio|viagem|show|shopping|festa|lazer/i.test(text)) return "Lazer";

  if (/trabalho|cliente|empresa|reuni[aã]o|ferramenta|escrit[oó]rio|software|profissional/i.test(text)) return "Profissional";

  if (/escola|faculdade|curso|livro|aula|educa[cç][aã]o|material escolar/i.test(text)) return "Educação";

  if (/roupa|sapato|cabelo|barbeiro|sal[aã]o|beleza|presente|academia/i.test(text)) return "Pessoal";

  return "Outros";
}

function getAmount(text) {
  const match = text.replace(",", ".").match(/(\d+(?:\.\d{1,2})?)/);
  return match ? Number(match[1]) : 0;
}

function cleanDescription(text) {
  const cleaned = text
    .replace(/gastei|paguei|comprei|recebi|ganhei|reais|real|r\$/gi, "")
    .replace(/[0-9.,]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(com|no|na|de)\s+/i, "");

  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : "Lançamento";
}

function App() {
  const [entries, setEntries] = useState([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Segure o botão e fale seu gasto.");
  const [listening, setListening] = useState(false);
  const [selected, setSelected] = useState("Despesa doméstica");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const recognitionRef = useRef(null);

  const summary = useMemo(() => {
    const income = entries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const expense = entries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);

    const categories = CATEGORIES.map(category => {
      const items = entries.filter(e => e.type === "expense" && e.category === category);
      return {
        category,
        amount: items.reduce((s, e) => s + e.amount, 0),
        count: items.length,
      };
    });

    return {
      income,
      expense,
      balance: income - expense,
      categories,
    };
  }, [entries]);

  const selectedItems = entries.filter(e => e.type === "expense" && e.category === selected);
  const selectedTotal = selectedItems.reduce((s, e) => s + e.amount, 0);
  const max = Math.max(...summary.categories.map(c => c.amount), 1);

  function addEntry(raw) {
    const phrase = raw.trim();
    const amount = getAmount(phrase);

    if (!phrase || amount <= 0) {
      setStatus("Não encontrei o valor. Exemplo: gastei 50 reais com gasolina.");
      return;
    }

    const type = isIncome(phrase) ? "income" : "expense";
    const category = getCategory(phrase);

    const entry = {
      id: Date.now(),
      text: phrase,
      type,
      category,
      amount,
      description: cleanDescription(phrase),
      date: new Date().toISOString(),
    };

    setEntries(prev => [entry, ...prev]);
    setText("");
    setStatus("Lançamento adicionado com sucesso.");

    if (type === "expense") setSelected(category);
  }

  function deleteEntry(id) {
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  function saveEdit(id) {
    const amount = getAmount(editText);
    if (!editText.trim() || amount <= 0) return;

    const type = isIncome(editText) ? "income" : "expense";
    const category = getCategory(editText);

    setEntries(prev =>
      prev.map(e =>
        e.id === id
          ? {
              ...e,
              text: editText,
              type,
              category,
              amount,
              description: cleanDescription(editText),
            }
          : e
      )
    );

    setEditingId(null);
    setEditText("");
    if (type === "expense") setSelected(category);
  }

  function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatus("Este navegador não liberou o microfone. Tente abrir no Safari/Chrome e permitir o microfone.");
      return;
    }

    if (listening) return;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setListening(true);
      setStatus("Ouvindo... solte para finalizar.");
    };

    recognition.onresult = event => {
      const transcript = event.results[0][0].transcript;
      setStatus(`Entendi: "${transcript}"`);
      addEntry(transcript);
    };

    recognition.onerror = () => {
      setListening(false);
      setStatus("Não consegui ouvir. Tente novamente.");
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
  }

  function stopVoice() {
    if (recognitionRef.current) {
      setStatus("Finalizando e organizando...");
      recognitionRef.current.stop();
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div style={styles.logo}>♛</div>
          <div>
            <h1 style={styles.title}>Organizeme</h1>
            <p style={styles.subtitle}>Organização financeira inteligente</p>
          </div>
        </header>

        <section style={styles.dashboard}>
          <p style={styles.gold}>Resumo do mês</p>
          <p style={styles.label}>Total gasto no mês</p>
          <h2 style={styles.big}>{money.format(summary.expense)}</h2>

          <div style={styles.metrics}>
            <Box title="Recebido" value={money.format(summary.income)} color={BRAND.success} />
            <Box title="Saldo" value={money.format(summary.balance)} color={summary.balance < 0 ? BRAND.red : BRAND.gold2} />
            <Box title="Lançamentos" value={entries.length} color={BRAND.muted} />
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Lançar por voz</h2>
          <p style={styles.small}>Segure o botão, fale e solte para organizar.</p>

          <div style={styles.inputRow}>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Ex: gastei 50 reais com gasolina"
              style={styles.input}
              onKeyDown={e => e.key === "Enter" && addEntry(text)}
            />
            <button onClick={() => addEntry(text)} style={styles.send}>➤</button>
          </div>

          <button
            onMouseDown={startVoice}
            onMouseUp={stopVoice}
            onMouseLeave={stopVoice}
            onTouchStart={e => {
              e.preventDefault();
              startVoice();
            }}
            onTouchEnd={e => {
              e.preventDefault();
              stopVoice();
            }}
            style={listening ? { ...styles.voice, transform: "scale(.97)" } : styles.voice}
          >
            🎤 {listening ? "Solte para finalizar" : "Segure para falar"}
          </button>

          <p style={styles.status}>{status}</p>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Categorias</h2>
          <p style={styles.small}>Toque em uma categoria para ver os detalhes.</p>

          <div style={styles.categoryGrid}>
            {summary.categories.map(cat => {
              const pct = cat.amount > 0 ? Math.max((cat.amount / max) * 100, 8) : 0;
              return (
                <button
                  key={cat.category}
                  onClick={() => setSelected(cat.category)}
                  style={selected === cat.category ? { ...styles.category, borderColor: BRAND.gold } : styles.category}
                >
                  <strong>{cat.category}</strong>
                  <span style={{ color: cat.amount > 0 ? BRAND.red : BRAND.success }}>{money.format(cat.amount)}</span>
                  <div style={styles.bar}>
                    <div style={{ ...styles.fill, width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>{selected}</h2>
          <p style={styles.small}>Total da categoria: {money.format(selectedTotal)}</p>

          {selectedItems.length === 0 && <div style={styles.empty}>Nenhum gasto nessa categoria ainda.</div>}

          {selectedItems.map(item => (
            <div key={item.id} style={styles.item}>
              {editingId === item.id ? (
                <div style={{ width: "100%" }}>
                  <input value={editText} onChange={e => setEditText(e.target.value)} style={styles.input} />
                  <div style={styles.actions}>
                    <button onClick={() => saveEdit(item.id)} style={styles.miniGold}>Salvar</button>
                    <button onClick={() => setEditingId(null)} style={styles.mini}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <strong>{item.description}</strong>
                    <p style={styles.small}>{new Date(item.date).toLocaleDateString("pt-BR")}</p>
                    <p style={styles.small}>{item.text}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <strong style={{ color: BRAND.red }}>-{money.format(item.amount)}</strong>
                    <div style={styles.actions}>
                      <button onClick={() => { setEditingId(item.id); setEditText(item.text); }} style={styles.mini}>Editar</button>
                      <button onClick={() => deleteEntry(item.id)} style={styles.miniRed}>Apagar</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Histórico</h2>
          {entries.length === 0 && <div style={styles.empty}>Nenhum lançamento ainda.</div>}
          {entries.map(item => (
            <div key={item.id} style={styles.history}>
              <span>{item.type === "income" ? "Entrada" : item.category}</span>
              <strong style={{ color: item.type === "income" ? BRAND.success : BRAND.red }}>
                {item.type === "income" ? "+" : "-"}{money.format(item.amount)}
              </strong>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

function Box({ title, value, color }) {
  return (
    <div style={styles.box}>
      <p style={styles.small}>{title}</p>
      <strong style={{ color, fontSize: 18 }}>{value}</strong>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: BRAND.bg,
    color: BRAND.cream,
    fontFamily: "Arial, sans-serif",
  },
  shell: {
    maxWidth: 760,
    margin: "0 auto",
    padding: 14,
  },
  header: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  logo: {
    width: 58,
    height: 58,
    borderRadius: 20,
    display: "grid",
    placeItems: "center",
    background: `linear-gradient(135deg, ${BRAND.gold2}, ${BRAND.gold})`,
    color: BRAND.bg,
    fontSize: 28,
  },
  title: { margin: 0, fontSize: 30 },
  subtitle: { margin: 0, color: BRAND.muted },
  dashboard: {
    border: "1px solid rgba(240,221,154,.25)",
    borderRadius: 28,
    padding: 18,
    background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.card})`,
    marginBottom: 14,
    overflow: "hidden",
  },
  gold: { color: BRAND.gold2, margin: 0 },
  label: { color: BRAND.muted, marginTop: 18 },
  big: {
    fontSize: "clamp(44px, 14vw, 68px)",
    margin: "4px 0 16px",
    lineHeight: 1,
  },
  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
  },
  box: {
    background: "rgba(18,53,46,.55)",
    border: "1px solid rgba(240,221,154,.15)",
    borderRadius: 18,
    padding: 10,
    minWidth: 0,
    overflow: "hidden",
  },
  card: {
    background: "rgba(24,61,53,.96)",
    border: "1px solid rgba(240,221,154,.18)",
    borderRadius: 26,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: { margin: "0 0 4px", fontSize: 24 },
  small: { margin: 0, color: BRAND.muted, fontSize: 13 },
  inputRow: { display: "flex", gap: 8, marginTop: 14 },
  input: {
    flex: 1,
    minWidth: 0,
    height: 48,
    borderRadius: 18,
    border: "1px solid rgba(240,221,154,.25)",
    background: "rgba(18,53,46,.8)",
    color: BRAND.cream,
    padding: "0 12px",
    boxSizing: "border-box",
  },
  send: {
    width: 52,
    border: 0,
    borderRadius: 18,
    background: BRAND.gold,
    color: BRAND.bg,
    fontWeight: 900,
  },
  voice: {
    width: "100%",
    marginTop: 12,
    minHeight: 64,
    border: 0,
    borderRadius: 24,
    background: `linear-gradient(90deg, ${BRAND.gold2}, ${BRAND.gold})`,
    color: BRAND.bg,
    fontWeight: 900,
    fontSize: 18,
    touchAction: "none",
  },
  status: { textAlign: "center", color: BRAND.muted, fontSize: 13 },
  categoryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))",
    gap: 10,
    marginTop: 14,
  },
  category: {
    textAlign: "left",
    color: BRAND.cream,
    background: "rgba(31,75,64,.65)",
    border: "1px solid rgba(240,221,154,.16)",
    borderRadius: 18,
    padding: 12,
  },
  bar: {
    height: 8,
    background: "rgba(18,53,46,.8)",
    borderRadius: 99,
    overflow: "hidden",
    marginTop: 8,
  },
  fill: {
    height: "100%",
    background: BRAND.gold,
  },
  empty: {
    border: "1px dashed rgba(240,221,154,.28)",
    borderRadius: 18,
    padding: 14,
    color: BRAND.muted,
    marginTop: 12,
    textAlign: "center",
  },
  item: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    background: "rgba(44,103,88,.45)",
    borderRadius: 18,
    padding: 12,
    marginTop: 10,
  },
  actions: {
    display: "flex",
    gap: 6,
    marginTop: 8,
    flexWrap: "wrap",
  },
  mini: {
    border: "1px solid rgba(240,221,154,.2)",
    background: "transparent",
    color: BRAND.cream,
    borderRadius: 99,
    padding: "5px 8px",
  },
  miniGold: {
    border: 0,
    background: BRAND.gold,
    color: BRAND.bg,
    borderRadius: 99,
    padding: "6px 10px",
    fontWeight: 800,
  },
  miniRed: {
    border: "1px solid rgba(255,107,107,.4)",
    background: "rgba(255,107,107,.12)",
    color: "#ffd1cd",
    borderRadius: 99,
    padding: "5px 8px",
  },
  history: {
    display: "flex",
    justifyContent: "space-between",
    borderBottom: "1px solid rgba(240,221,154,.12)",
    padding: "10px 0",
  },
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
