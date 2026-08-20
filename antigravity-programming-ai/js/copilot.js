/* ==========================================================================
   MECUZI FARM MANAGEMENT SYSTEM — AI Copilot / Assistant Core
   Implementing AI_ASSISTANT_SPEC.md §3–§8

   Architecture (mirrors the production contract):
   - SOP ingestion & vector pipeline (§3.1): semantic chunking of
     PON-AGR-MEC-V2.0 by logical boundaries, metadata-rich chunks
     (chunk_id/version/section_ref/title), deterministic local embeddings +
     BM25 hybrid retrieval with similarity thresholding.
   - Tool calling (§3.2, §10): every tool wraps an EXISTING MockAPI endpoint
     and forwards the requesting user's JWT — no parallel data access, no
     privilege bypass. A 403 from the backend is reported to the user as a
     restriction, never worked around (§5).
   - Dynamic language detection (§6): from the message payload, independent
     of the UI locale. The reply is composed exclusively in that language.
   - Anti-hallucination (§7): SOP answers carry [SOP §x.y] citations from
     retrieved chunks; data answers quote live tool payloads; anything else
     gets the explicit "no access" fallback, never a guess.
   - Audit (§8): every query logged via POST /ai/audit with user_id, prompt,
     language, SOP sections, tools, response and latency.

   NOTE (demo build): the planner/answer composer here is deterministic —
   the production build swaps `planToolCalls`/`composeAnswer` for the LLM
   call (buildSystemPrompt below is its system prompt) without touching the
   retrieval, tool, auth or audit layers.

   CLI ingestion of the full SOP (no code changes, §3.1):
     node -e "const fs=require('fs');eval(fs.readFileSync('js/data.js','utf8')+'\nglobalThis.MECUZI_DATA=MECUZI_DATA;');eval(fs.readFileSync('js/api.js','utf8'));eval(fs.readFileSync('js/copilot.js','utf8'));(async()=>{const l=await MockAPI.login('TZ10000099','1099');const v=await MockAPI.verifyOtp(l.data.challengeId,l.data.devOtp);const r=await MockAPI.ingestSopDocument(v.data.accessToken,{text:fs.readFileSync('PON-AGR-MEC-V2.0.txt','utf8'),version:'2.0',replaceVersion:true});console.log(r);})();"

   This file is DOM-free on purpose: it also runs under Node.js for the
   verification suite (tests/ai-copilot.test.js).
   ========================================================================== */

(function (global) {
  'use strict';

  function db() {
    return (typeof MECUZI_DATA !== 'undefined') ? MECUZI_DATA : global.MECUZI_DATA;
  }

  /* ==========================================================================
     §3.1 — SOP INGESTION & VECTOR PIPELINE
     ========================================================================== */

  // Tokenizer: latin words (accents kept) + CJK bigrams so Chinese SOP
  // content and queries are searchable too. Stopwords are stripped — they
  // add retrieval noise without signal.
  const STOPWORDS = new Set(['de', 'do', 'da', 'em', 'no', 'na', 'os', 'as', 'um', 'uma',
    'que', 'com', 'para', 'por', 'ao', 'aos', 'the', 'and', 'for', 'are', 'was', 'with',
    'this', 'that', 'from', 'you', 'your']);
  function tokenize(text) {
    const s = String(text || '').toLowerCase();
    const tokens = (s.match(/[a-zà-ÿ0-9]{2,}/gi) || []).filter(w => !STOPWORDS.has(w));
    const cjk = s.match(/[一-鿿㐀-䶿]/g) || [];
    for (let i = 0; i < cjk.length - 1; i++) tokens.push(cjk[i] + cjk[i + 1]);
    return tokens;
  }

  // Deterministic local embedding (signed feature hashing, D=512) over token
  // unigrams + bigrams, L2-normalized. Stands in for the production embedding
  // model (vector(1536)); the retrieval contract is identical.
  const EMBED_DIM = 512;
  function embedText(text) {
    const vec = new Array(EMBED_DIM).fill(0);
    const tokens = tokenize(text);
    const feats = tokens.slice();
    for (let i = 0; i < tokens.length - 1; i++) feats.push(tokens[i] + '|' + tokens[i + 1]);
    feats.forEach(f => {
      let h = 2166136261;
      for (let i = 0; i < f.length; i++) { h ^= f.charCodeAt(i); h = Math.imul(h, 16777619); }
      const idx = (h >>> 0) % EMBED_DIM;
      vec[idx] += (h & 1) ? 1 : -1;
    });
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map(v => v / norm);
  }

  function cosineSim(a, b) {
    let dot = 0;
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
    return dot; // both vectors are L2-normalized
  }

  // Chunker: split on logical SOP boundaries — section markers (§3.1),
  // numbered headings, or markdown headers; oversized paragraphs are packed
  // to ~700 chars. Every chunk carries chunk_id/version/section_ref/title.
  function chunkSopText(text, version) {
    const parts = String(text)
      .split(/(?=§\s?\d+(?:\.\d+)?)|(?=^#{1,3}\s)|(?=^\d+\.\d+\s)/m)
      .map(p => p.trim())
      .filter(p => p.length > 20);
    const chunks = [];
    let buf = '';
    const flush = () => {
      if (buf.trim().length > 20) chunks.push(buf.trim());
      buf = '';
    };
    parts.forEach(p => {
      if (/^(§\s?\d|#{1,3}\s|\d+\.\d+\s)/.test(p)) { flush(); buf = p; }
      else if ((buf + '\n\n' + p).length > 700) { flush(); buf = p; }
      else { buf = buf ? buf + '\n\n' + p : p; }
    });
    flush();

    return chunks.map((c, i) => {
      const refMatch = /§\s?(\d+(?:\.\d+)?)/.exec(c) || /^(\d+\.\d+)\s/.exec(c);
      const firstLine = c.split('\n')[0].replace(/^#{1,3}\s*/, '').slice(0, 80);
      return {
        id: `SOP-${version}-${String(i + 1).padStart(4, '0')}`,
        version: String(version),
        section_ref: refMatch ? `§${refMatch[1]}` : `§auto-${i + 1}`,
        title: firstLine,
        content: c,
        created_at: new Date().toISOString()
      };
    });
  }

  function chunkAndEmbed(text, version) {
    return chunkSopText(text, version).map(c =>
      Object.assign(c, { embedding: embedText(`${c.title} ${c.content}`) }));
  }

  // Hybrid retrieval: cosine similarity (vector) + BM25 (keyword), fused
  // 50/50 after BM25 max-normalization, with similarity thresholding (§3.1).
  // BM25 with an ABSOLUTE per-query normalization (sum of idf × the k1+1
  // asymptote) — normalizing by the best doc would inflate near-zero matches
  // to 1.0 and defeat the similarity threshold.
  function bm25Scores(queryTokens, docs) {
    const k1 = 1.5, b = 0.75;
    const avgLen = docs.reduce((s, d) => s + d.tokens.length, 0) / (docs.length || 1) || 1;
    const df = {};
    docs.forEach(d => {
      new Set(d.tokens).forEach(tok => { df[tok] = (df[tok] || 0) + 1; });
    });
    const N = docs.length || 1;
    const uniqueQ = [...new Set(queryTokens)];
    const idf = (q) => Math.log(1 + (N - (df[q] || 0) + 0.5) / ((df[q] || 0) + 0.5));
    const norm = uniqueQ.reduce((s, q) => s + (df[q] ? idf(q) * (k1 + 1) : 0), 0) || 1e-9;
    const scores = docs.map(d => {
      const tf = {};
      d.tokens.forEach(tok => { tf[tok] = (tf[tok] || 0) + 1; });
      let score = 0;
      uniqueQ.forEach(q => {
        if (!tf[q]) return;
        score += idf(q) * (tf[q] * (k1 + 1)) / (tf[q] + k1 * (1 - b + b * d.tokens.length / avgLen));
      });
      return score;
    });
    return { scores, norm };
  }

  const RETRIEVAL_THRESHOLD = 0.10;
  function retrieveSopChunks(query, opts = {}) {
    const topK = opts.topK || 2;
    const version = opts.version || null; // null = latest/all versions
    const chunks = db().sopChunks.filter(c => !version || c.version === version);
    if (chunks.length === 0) return [];

    const qEmbed = embedText(query);
    const qTokens = tokenize(query);
    const docs = chunks.map(c => {
      if (!c.embedding) c.embedding = embedText(`${c.title} ${c.content}`); // lazy cache
      return { chunk: c, tokens: tokenize(`${c.title} ${c.content}`) };
    });
    const { scores: bm25, norm } = bm25Scores(qTokens, docs);

    return docs.map((d, i) => ({
      chunk: d.chunk,
      cos: Math.max(0, cosineSim(qEmbed, d.chunk.embedding)),
      bm25n: bm25[i] / norm,
      score: 0.5 * Math.max(0, cosineSim(qEmbed, d.chunk.embedding)) + 0.5 * (bm25[i] / norm)
    }))
      // Hybrid gate: keyword evidence (BM25) OR a strong vector-only match.
      // A bare fused threshold lets hash-collision noise retrieve irrelevant
      // chunks for out-of-domain queries (anti-hallucination, §7).
      .filter(r => r.score >= RETRIEVAL_THRESHOLD && (r.bm25n >= 0.02 || r.cos >= 0.5))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /* ==========================================================================
     §6 — DYNAMIC LANGUAGE DETECTION (from the message payload, never the UI)
     ========================================================================== */
  function detectLanguage(text) {
    if (/[一-鿿㐀-䶿]/.test(text)) return 'zh';
    const words = (String(text).toLowerCase().match(/[a-zà-ÿ]+/gi) || []);
    const PT = new Set(['que', 'qual', 'quais', 'como', 'quando', 'onde', 'para', 'com', 'sem',
      'uma', 'são', 'esta', 'está', 'furo', 'talhão', 'talhões', 'orçamento', 'incêndio',
      'fumo', 'fogo', 'chuva', 'relatório', 'relatórios', 'sincronização', 'não', 'meu',
      'minha', 'preciso', 'quero', 'posso', 'fazer', 'procedimento', 'desvio', 'estado']);
    const EN = new Set(['the', 'what', 'which', 'how', 'when', 'where', 'with', 'without',
      'show', 'tell', 'budget', 'fire', 'smoke', 'rain', 'report', 'reports', 'sync',
      'field', 'borehole', 'please', 'should', 'does', 'status', 'procedure', 'variance']);
    // Keep detection independent from the selected UI locale. The original
    // vocabulary was too narrow, so ordinary English requests with no exact
    // keyword fell through to the Portuguese default.
    ['can', 'could', 'would', 'will', 'give', 'me', 'my', 'your', 'you', 'explain',
      'summary', 'current', 'production', 'data', 'available', 'is', 'are', 'do',
      'why', 'need', 'want', 'help', 'work', 'works', 'working', 'list', 'provide',
      'and', 'or', 'this', 'that', 'from', 'to', 'of', 'in', 'on', 'about', 'risk',
      'output'].forEach(word => EN.add(word));
    ['quem', 'ganhou', 'isso', 'isto', 'sobre', 'dados', 'risco', 'resumo'].forEach(word => PT.add(word));
    let pt = 0, en = 0;
    words.forEach(w => { if (PT.has(w)) pt++; if (EN.has(w)) en++; });
    return en > pt ? 'en' : 'pt'; // default: system primary language (pt-MZ)
  }

  /* ==========================================================================
     §7 — RESPONSE STRINGS per detected language (response content is keyed
     by the DETECTED language, not the UI locale — by design, §6)
     ========================================================================== */
  const STRINGS = {
    pt: {
      dataHeader: 'Dados em tempo real do sistema:',
      sopHeader: 'Procedimento — SOP PON-AGR-MEC-V2.0:',
      unknown: 'Não tenho acesso a essa informação no SOP nem nos dados em tempo real do sistema.',
      forbidden: 'O seu papel não tem permissão para estes dados — o sistema recusou o acesso (403). Contacte o Administrador se precisar deste acesso.',
      labels: {
        get_borehole_metrics: 'Leituras dos furos', get_field_status: 'Estado dos talhões',
        get_inventory_levels: 'Níveis de inventário', get_budget_variance: 'Desvio orçamental',
        get_sync_status: 'Estado de sincronização', get_climate_alerts: 'Alertas climáticos'
      },
      status: { 'v.normal': 'normal', 'v.anomalia_120': 'ANOMALIA >120%', 'on-track': 'em curso', 'attention-needed': 'precisa atenção', 'v.ok': 'OK', 'v.stock_baixo': 'stock baixo' },
      boreholeLine: (r) => `Furo ${r.id}: ${r.readingM3} m³ (média ${r.avgM3} m³)`,
      fieldLine: (f) => `${f.id}: ${f.areaHa} ha — ${f.status}`,
      inventoryLine: (n, low) => `${n} itens registados, ${low} abaixo do limite`,
      budgetLine: (planned, actual, pct) => `Planeado ${planned.toLocaleString('pt-PT')} MZN vs. real ${actual.toLocaleString('pt-PT')} MZN (desvio ${pct}%)`,
      syncLine: (pending, synced) => `${pending} registo(s) pendente(s) no dispositivo, ${synced} sincronizado(s)`,
      climateLine: (c, w, crit) => `${crit} crítico(s), ${w} aviso(s), ${c} vigilância`,
      pendingIds: (ids) => `Pendentes: ${ids.join(', ')}`
    },
    en: {
      dataHeader: 'Live system data:',
      sopHeader: 'Procedure — SOP PON-AGR-MEC-V2.0:',
      unknown: 'I do not have access to this information in the SOP or live system data.',
      forbidden: 'Your role does not have permission for this data — the backend refused access (403). Contact an Administrator if you need it.',
      labels: {
        get_borehole_metrics: 'Borehole readings', get_field_status: 'Field status',
        get_inventory_levels: 'Inventory levels', get_budget_variance: 'Budget variance',
        get_sync_status: 'Sync status', get_climate_alerts: 'Climate alerts'
      },
      status: { 'v.normal': 'normal', 'v.anomalia_120': '>120% ANOMALY', 'on-track': 'on track', 'attention-needed': 'needs attention', 'v.ok': 'OK', 'v.stock_baixo': 'low stock' },
      boreholeLine: (r) => `Borehole ${r.id}: ${r.readingM3} m³ (avg ${r.avgM3} m³)`,
      fieldLine: (f) => `${f.id}: ${f.areaHa} ha — ${f.status}`,
      inventoryLine: (n, low) => `${n} items on record, ${low} below threshold`,
      budgetLine: (planned, actual, pct) => `Planned ${planned.toLocaleString('en-GB')} MZN vs. actual ${actual.toLocaleString('en-GB')} MZN (variance ${pct}%)`,
      syncLine: (pending, synced) => `${pending} record(s) pending on device, ${synced} synced`,
      climateLine: (c, w, crit) => `${crit} critical, ${w} warning(s), ${c} watch`,
      pendingIds: (ids) => `Pending: ${ids.join(', ')}`
    },
    zh: {
      dataHeader: '即時系統資料：',
      sopHeader: '作業程序 — SOP PON-AGR-MEC-V2.0：',
      unknown: '我無法從 SOP 或即時系統資料中取得此資訊。',
      forbidden: '您的角色無權存取此資料 — 後端已拒絕存取（403）。如需權限請聯絡管理員。',
      labels: {
        get_borehole_metrics: '水井讀數', get_field_status: '田塊狀態',
        get_inventory_levels: '庫存水位', get_budget_variance: '預算差異',
        get_sync_status: '同步狀態', get_climate_alerts: '氣候警報'
      },
      status: { 'v.normal': '正常', 'v.anomalia_120': '>120% 異常', 'on-track': '正常', 'attention-needed': '需注意', 'v.ok': '正常', 'v.stock_baixo': '庫存不足' },
      boreholeLine: (r) => `水井 ${r.id}：${r.readingM3} m³（平均 ${r.avgM3} m³）`,
      fieldLine: (f) => `${f.id}：${f.areaHa} 公頃 — ${f.status}`,
      inventoryLine: (n, low) => `共 ${n} 項，${low} 項低於安全存量`,
      budgetLine: (planned, actual, pct) => `預算 ${planned.toLocaleString()} MZN，實支 ${actual.toLocaleString()} MZN（差異 ${pct}%）`,
      syncLine: (pending, synced) => `裝置上 ${pending} 筆待同步，${synced} 筆已同步`,
      climateLine: (c, w, crit) => `危急 ${crit}、警告 ${w}、觀察 ${c}`,
      pendingIds: (ids) => `待同步：${ids.join(', ')}`
    }
  };

  /* ==========================================================================
     §3.2 — TOOL DEFINITIONS & API PROXY (§10: wrap existing endpoints,
     forward the requesting user's JWT; never invent parallel data access)
     OpenAI/Vercel-AI-SDK-style function signatures.
     ========================================================================== */
  const COPILOT_TOOLS = [
    { name: 'get_borehole_metrics', description: 'Latest borehole/water-meter readings vs 30-day averages (Operations Support)', parameters: { type: 'object', properties: {}, required: [] } },
    { name: 'get_field_status', description: 'Field/plot status list (role-scoped by the backend)', parameters: { type: 'object', properties: {}, required: [] } },
    { name: 'get_inventory_levels', description: 'Agricultural input inventory levels and low-stock flags', parameters: { type: 'object', properties: {}, required: [] } },
    { name: 'get_budget_variance', description: 'Operational budget lines: planned vs actual (Finance & Compliance — restricted)', parameters: { type: 'object', properties: {}, required: [] } },
    { name: 'get_sync_status', description: "Caller's own offline sync queue state (pending vs synced records)", parameters: { type: 'object', properties: {}, required: [] } },
    { name: 'get_climate_alerts', description: 'Active weather/fire alerts (role-scoped; Top Management receives the org-wide aggregate)', parameters: { type: 'object', properties: {}, required: [] } }
  ];

  // Tool executor — every call carries the user's token straight through to
  // the existing API layer (the production build sets it as the Authorization:
  // Bearer header on the REST call). 403/404 surface cleanly to the agent.
  async function executeCopilotTool(name, args, authToken) {
    let res;
    switch (name) {
      case 'get_borehole_metrics':
        res = await global.MockAPI.listUnitRecords(authToken, 'borehole_reading'); break;
      case 'get_field_status':
        res = await global.MockAPI.listFields(authToken); break;
      case 'get_inventory_levels':
        res = await global.MockAPI.listUnitRecords(authToken, 'inventory_item'); break;
      case 'get_budget_variance':
        res = await global.MockAPI.listUnitRecords(authToken, 'budget_line'); break;
      case 'get_sync_status':
        res = await global.MockAPI.getSyncStatus(authToken); break;
      case 'get_climate_alerts':
        res = await global.MockAPI.listClimateAlerts(authToken);
        if (!res.ok && res.status === 403) {
          // Top Management: per-field detail is forbidden by design — the
          // org-wide aggregate endpoint is its sanctioned view (§7 of the
          // weather spec). Still the backend, still the user's own token.
          res = await global.MockAPI.getClimateOrgSummary(authToken);
        }
        break;
      default:
        return { tool: name, ok: false, status: 404, error: 'errors.tool_unknown' };
    }
    return { tool: name, ok: res.ok, status: res.status, data: res.data, error: res.error };
  }

  /* --- Deterministic planner (demo build) — the production LLM replaces
         this intent mapping; tool schemas above are its function list. --- */
  const TOOL_INTENTS = [
    { tool: 'get_borehole_metrics', re: /furo|borehole|水井|井水|水錶|consumo de água/i },
    { tool: 'get_field_status', re: /talh[aã]o|talhões|field status|plot|田塊|田區|estado dos/i },
    { tool: 'get_inventory_levels', re: /invent[aá]rio|stock|庫存|存貨|insumos|fertiliz/i },
    { tool: 'get_budget_variance', re: /or[cç]amento|budget|預算|desvio|variance|custo/i },
    { tool: 'get_sync_status', re: /sincroniza|sync|offline|同步|離線|pendente|pending/i },
    { tool: 'get_climate_alerts', re: /clima|climate|meteo|inc[eê]ndio|fogo|fumo|fire|smoke|火災|濃煙|警報|alerta|alert|chuva|rain|seca|drought|vento|wind|ciclone|cyclone/i }
  ];

  function planToolCalls(query) {
    return TOOL_INTENTS.filter(ti => ti.re.test(query)).map(ti => ({ tool: ti.tool, args: {} }));
  }

  /* ==========================================================================
     §7 — SYSTEM PROMPT (production LLM contract: anti-hallucination,
     citation syntax, language reflection, tone)
     ========================================================================== */
  function buildSystemPrompt(language) {
    return [
      'You are the Mecuzi Farm Management copilot for Fundação Tzu Chi Moçambique.',
      `Reply EXCLUSIVELY in ${language} (the language of the user message), regardless of UI locale.`,
      'RULES (anti-hallucination):',
      '1. Answer procedure/guideline questions ONLY from the retrieved SOP chunks provided, and cite every procedural claim inline as [SOP §x.y] using the chunk section_ref.',
      '2. Answer data questions ONLY from tool results provided; quote the exact values returned. Never invent figures.',
      '3. If neither SOP chunks nor tool results answer the question, respond with exactly: "I do not have access to this information in the SOP or live system data." (translated into the reply language).',
      '4. If a tool result is HTTP 403, tell the user their role does not have permission for that data. Never work around it.',
      '5. Tone: concise, operational, respectful; short sentences suitable for field staff.'
    ].join('\n');
  }

  /* --- Answer composer (demo build, deterministic — quotes only retrieved
         chunks and live tool payloads, per §7) --- */
  function summarizeTool(ex, S) {
    const d = ex.data;
    switch (ex.tool) {
      case 'get_borehole_metrics':
        return d.map(r => `${S.boreholeLine(r)} — ${S.status[r.status] || r.status}`).join('\n');
      case 'get_field_status':
        return d.map(f => `${S.fieldLine(f)} — ${S.status[f.status] || f.status}`).join('\n');
      case 'get_inventory_levels': {
        const low = d.filter(i => i.status === 'v.stock_baixo').length;
        return S.inventoryLine(d.length, low);
      }
      case 'get_budget_variance': {
        const planned = d.reduce((s, r) => s + r.plannedMzn, 0);
        const actual = d.reduce((s, r) => s + r.actualMzn, 0);
        const pct = planned ? Math.round((actual - planned) / planned * 1000) / 10 : 0;
        return S.budgetLine(planned, actual, pct);
      }
      case 'get_sync_status': {
        const base = S.syncLine(d.pending.length, d.syncedCount);
        return d.pending.length ? `${base}\n${S.pendingIds(d.pending.map(p => p.id))}` : base;
      }
      case 'get_climate_alerts': {
        if (d.bySeverity) { // org-wide aggregate (Top Management)
          return S.climateLine(d.bySeverity.watch, d.bySeverity.warning, d.bySeverity.critical);
        }
        const crit = d.filter(a => a.severity === 'critical').length;
        const warn = d.filter(a => a.severity === 'warning').length;
        const watch = d.filter(a => a.severity === 'watch').length;
        return S.climateLine(watch, warn, crit);
      }
      default:
        return '';
    }
  }

  function composeAnswer(language, retrieved, executions) {
    const S = STRINGS[language];
    const sections = [];
    const okExecs = executions.filter(e => e.ok);
    const forbidden = executions.filter(e => !e.ok && e.status === 403);

    if (okExecs.length) {
      sections.push(S.dataHeader + '\n' + okExecs.map(e =>
        `• ${S.labels[e.tool]}: ${summarizeTool(e, S)}`).join('\n'));
    }
    if (retrieved.length) {
      sections.push(S.sopHeader + '\n' + retrieved.map(r => {
        const c = r.chunk;
        const body = (language === 'en' && c.contentEn) ? c.contentEn
          : (language === 'zh' && c.contentZh) ? c.contentZh : c.content;
        return `${body} [SOP ${c.section_ref}]`;
      }).join('\n'));
    }
    if (forbidden.length) {
      sections.push(`⚠ ${S.labels[forbidden[0].tool]}: ${S.forbidden}`);
    }
    if (!sections.length) return S.unknown; // §7: never guess
    return sections.join('\n\n');
  }

  /* ==========================================================================
     §4/§5/§8 — CORE AGENT HANDLER (the unified pipeline; quick-reply chips
     feed straight into this, per §4)
     ========================================================================== */
  async function handleQuery(authToken, queryText) {
    const started = Date.now();
    const prompt = String(queryText || '').trim();
    const language = detectLanguage(prompt); // §6

    // SOP hybrid retrieval (§3.1) + tool loop with JWT forwarding (§3.2/§5)
    const retrieved = retrieveSopChunks(prompt, { topK: 2 });
    const planned = planToolCalls(prompt);
    const executions = [];
    for (const p of planned) {
      executions.push(await executeCopilotTool(p.tool, p.args, authToken));
    }

    let reply = composeAnswer(language, retrieved, executions);
    // The free OpenRouter route is an optional server-side writing layer. The
    // deterministic grounded answer remains the fallback and test baseline.
    if (typeof window !== 'undefined' && global.MockAPI && global.MockAPI.composeCopilotAnswer) {
      try {
        const composed = await global.MockAPI.composeCopilotAnswer(
          prompt,
          language,
          reply,
          retrieved.map(r => `SOP ${r.chunk.section_ref}`)
        );
        if (composed && composed.ok && typeof composed.data.answer === 'string') reply = composed.data.answer;
      } catch (e) { /* provider failure must not break the grounded response */ }
    }
    const latencyMs = Date.now() - started;

    // §8: audit every query (write-ahead via the API; best-effort — a logging
    // failure must never break the user-facing answer)
    if (authToken && global.MockAPI) {
      try {
        await global.MockAPI.logCopilotQuery(authToken, {
          prompt,
          language,
          used_sop_sections: retrieved.map(r => r.chunk.section_ref),
          used_tools: executions.map(e => ({ tool: e.tool, status: e.status })),
          response: reply,
          latency_ms: latencyMs
        });
      } catch (e) { /* audit failure must not break the reply */ }
    }

    return {
      reply,
      language,
      citations: retrieved.map(r => `SOP ${r.chunk.section_ref}`),
      tools: executions.map(e => ({ tool: e.tool, status: e.status })),
      latencyMs
    };
  }

  global.CopilotSOP = { tokenize, embedText, chunkSopText, chunkAndEmbed, retrieveSopChunks, EMBED_DIM };
  global.CopilotPrompts = { detectLanguage, buildSystemPrompt, STRINGS };
  global.CopilotTools = { COPILOT_TOOLS, executeCopilotTool, planToolCalls };
  global.CopilotAgent = { handleQuery };

})(typeof window !== 'undefined' ? window : globalThis);
