/* ==========================================================================
   AI_ASSISTANT_SPEC.md — Verification Suite (File 6)

   Runs the real js/data.js + js/api.js + js/copilot.js under Node.js and
   proves:
     1. Language detection accuracy across PT / EN / ZH (§6)
     2. SOP retrieval + citation attachment for procedure queries (§3.1, §7)
     3. RBAC delegation: technician asking for budget data gets a graceful
        403 restriction, never data (§5); admin_manager gets the data
     4. Anti-hallucination fallback on out-of-bounds questions (§7)
     5. Tool calls forward the user's own JWT (a 401 token breaks them) (§10)
     6. Audit log entries carry every required field (§8)
     7. SOP ingestion pipeline: chunk + embed + version-tagged upsert of new
        document text without code changes, admin-only (§3.1)

   Usage:  node tests/ai-copilot.test.js
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8') + '\nglobalThis.MECUZI_DATA = MECUZI_DATA;');
eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'api.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'copilot.js'), 'utf8'));

const { MockAPI, CopilotAgent, CopilotPrompts, CopilotSOP, CopilotTools } = globalThis;
const DB = globalThis.MECUZI_DATA;

let passed = 0;
let failed = 0;
function check(label, condition) {
  if (condition) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}`); }
}

async function loginAs(employeeNumber, pin) {
  const l = await MockAPI.login(employeeNumber, pin);
  if (!l.ok) return null;
  const v = await MockAPI.verifyOtp(l.data.challengeId, l.data.devOtp);
  return v.ok ? v.data.accessToken : null;
}

// In this Render demo, auth is server-owned: MockAPI endpoints accept a
// public session-claims object (same shape the Express session endpoint
// returns) instead of a client-signed JWT. Mirror the climate suite's helper.
function claims(employeeNumber, name, role) {
  return { employeeNumber, sub: employeeNumber, name, role, roleKey: `roles.${role}`, status: 'active' };
}

async function main() {
  const tokTech = claims('TZ11244045', 'Farm Technician', 'farm_technician');
  const tokAdminMgr = claims('TZ13000001', 'Administrative Manager', 'admin_manager');
  const tokAdmin = claims('TZ10000099', 'Administrator', 'administrator');
  const tokTM = claims('TZ10000001', 'Top Management', 'top_management');

  console.log('\n=== 1. Dynamic language detection (§6) ===');
  check('PT detected from Portuguese payload',
    CopilotPrompts.detectLanguage('Qual é o procedimento para o furo com consumo acima de 120%?') === 'pt');
  check('EN detected from English payload',
    CopilotPrompts.detectLanguage('What is the procedure when a borehole exceeds 120%?') === 'en');
  check('ZH detected from Chinese payload',
    CopilotPrompts.detectLanguage('水井讀數超過120%時應該怎麼辦？') === 'zh');
  check('detection ignores UI locale entirely (pure payload function)',
    CopilotPrompts.detectLanguage('How does offline sync work?') === 'en');

  console.log('\n=== 2. SOP retrieval + grounded citations (§3.1, §7) ===');
  const sopQuery = await CopilotAgent.handleQuery(tokTech, 'Qual é o procedimento quando o furo excede 120% da média?');
  check('SOP procedure query retrieves the ADM-WTR-01 chunk',
    sopQuery.citations.includes('SOP §3.1'));
  check('answer carries the [SOP §3.1] citation inline',
    sopQuery.reply.includes('[SOP §3.1]'));
  check('PT question answered in PT regardless of anything else',
    sopQuery.language === 'pt' && /Coordenador/.test(sopQuery.reply));
  const sopQueryEn = await CopilotAgent.handleQuery(tokTech, 'What should I do when a borehole reading exceeds 120%?');
  check('same query in EN retrieves the same chunk and answers in EN',
    sopQueryEn.language === 'en' && sopQueryEn.reply.includes('[SOP §3.1]') &&
    /dispatch|inspection/i.test(sopQueryEn.reply));
  const sopQueryZh = await CopilotAgent.handleQuery(tokTech, '水井讀數超過120%時應該怎麼辦？');
  check('same query in ZH answers in Traditional Chinese with citation',
    sopQueryZh.language === 'zh' && sopQueryZh.reply.includes('[SOP §3.1]') &&
    /檢查小組/.test(sopQueryZh.reply));

  console.log('\n=== 3. Tool calling with live data + RBAC delegation (§3.2, §5, §10) ===');
  const bh = await CopilotAgent.handleQuery(tokAdminMgr, 'Como estão as leituras dos furos de água?');
  check('borehole tool executed and returned live payload values',
    bh.tools.some(t => t.tool === 'get_borehole_metrics' && t.status === 200) &&
    bh.reply.includes('55.2') && bh.reply.includes('FR-602'));

  const techBudget = await CopilotAgent.handleQuery(tokTech, 'Qual é o desvio do orçamento operacional?');
  check('technician budget question -> tool forwarded token, got 403',
    techBudget.tools.some(t => t.tool === 'get_budget_variance' && t.status === 403));
  check('technician gets a graceful restriction notice, NOT budget figures',
    /403|permiss/i.test(techBudget.reply) && !techBudget.reply.includes('450000'));
  const mgrBudget = await CopilotAgent.handleQuery(tokAdminMgr, 'Qual é o desvio do orçamento operacional?');
  check('admin_manager budget question -> 200 with live planned/actual values',
    mgrBudget.tools.some(t => t.tool === 'get_budget_variance' && t.status === 200) &&
    mgrBudget.reply.includes('870') && mgrBudget.reply.includes('MZN')); // 870 000 planned (sum)

  const syncQ = await CopilotAgent.handleQuery(tokTech, 'Quantos relatórios tenho pendentes de sincronização?');
  check('sync status tool returns the technician own queue',
    syncQ.tools.some(t => t.tool === 'get_sync_status' && t.status === 200));

  const tmClimate = await CopilotAgent.handleQuery(tokTM, 'What is the current fire and climate risk?');
  check('Top Management climate question gets org-wide aggregate (never per-field 403 leak)',
    tmClimate.tools.some(t => t.tool === 'get_climate_alerts' && t.status === 200) &&
    /critical/i.test(tmClimate.reply));

  const badTokenExec = await CopilotTools.executeCopilotTool('get_borehole_metrics', {}, 'forged-token');
  check('tool with an invalid token is rejected by the backend (401/403), never bypassed',
    !badTokenExec.ok && (badTokenExec.status === 401 || badTokenExec.status === 403));

  console.log('\n=== 4. Anti-hallucination fallback (§7) ===');
  const oob = await CopilotAgent.handleQuery(tokTech, 'What is the airspeed velocity of an unladen swallow?');
  check('out-of-bounds EN question -> exact fallback sentence, no invented answer',
    oob.reply === CopilotPrompts.STRINGS.en.unknown);
  const oobPt = await CopilotAgent.handleQuery(tokTech, 'Quem ganhou o campeonato de futebol?');
  check('out-of-bounds PT question -> PT fallback, no guess',
    oobPt.reply === CopilotPrompts.STRINGS.pt.unknown);
  check('fallback triggered zero tool executions for the football question',
    oobPt.tools.length === 0);

  console.log('\n=== 5. Audit logging (§8) ===');
  const logCountBefore = DB.aiAuditLogs.length;
  await CopilotAgent.handleQuery(tokTech, 'Como funciona a sincronização offline?');
  check('every query writes an ai_audit_logs entry', DB.aiAuditLogs.length === logCountBefore + 1);
  const entry = DB.aiAuditLogs[0];
  check('entry has user_id from the JWT (never from the client payload)',
    entry.user_id === 'TZ11244045');
  check('entry carries prompt, detected language, SOP sections, tools, response, latency, timestamp',
    entry.prompt.length > 0 && entry.language === 'pt' &&
    Array.isArray(entry.used_sop_sections) && entry.used_sop_sections.includes('§4.2') &&
    Array.isArray(entry.used_tools) && typeof entry.response === 'string' &&
    typeof entry.latency_ms === 'number' && !!entry.created_at);
  check('query mirrored into the main AuditLog surface',
    DB.auditLogs.some(l => l.actionKey === 'audit_actions.COPILOT_QUERY'));
  const admView = await MockAPI.listAiAuditLogs(tokAdmin);
  const techView = await MockAPI.listAiAuditLogs(tokTech);
  check('AI audit logs readable by administrator only',
    admView.ok && admView.data.length === DB.aiAuditLogs.length && !techView.ok && techView.status === 403);

  console.log('\n=== 6. SOP ingestion pipeline (§3.1) ===');
  const newDoc = [
    '§8.1 Uso de EPI na aplicação de fitofármacos',
    'É obrigatório o uso de luvas, máscara e botas durante qualquer aplicação de fitofármacos. A reentrada no talhão só é permitida 24 horas após a aplicação.',
    '',
    '§8.2 Armazenamento de fitofármacos',
    'Os fitofármacos são armazenados trancados no armazém central, com registo de entrada e saída no livro de armazém.'
  ].join('\n');
  const denied = await MockAPI.ingestSopDocument(tokTech, { text: newDoc, version: '2.1' });
  check('SOP ingestion is administrator-only: 403 for technician', !denied.ok && denied.status === 403);
  const ingested = await MockAPI.ingestSopDocument(tokAdmin, { text: newDoc, version: '2.1', replaceVersion: true });
  check('full SOP text ingests without code changes (2 chunks, version 2.1)',
    ingested.ok && ingested.data.ingested === 2 && ingested.data.version === '2.1');
  const newChunks = DB.sopChunks.filter(c => c.version === '2.1');
  check('chunks carry chunk_id, version, section_ref, title, content, embedding',
    newChunks.every(c => c.id && c.version === '2.1' && /^§8\./.test(c.section_ref) &&
      c.title.length > 0 && c.content.length > 20 && Array.isArray(c.embedding)));
  check('embeddings are L2-normalized vectors',
    newChunks.every(c => Math.abs(c.embedding.reduce((s, v) => s + v * v, 0) - 1) < 0.01));
  const epi = await CopilotAgent.handleQuery(tokTech, 'Quais são as regras de EPI para aplicar fitofármacos?');
  check('newly ingested content is immediately retrievable with citation',
    epi.reply.includes('[SOP §8.1]'));
  check('ingestion audited', DB.auditLogs.some(l => l.actionKey === 'audit_actions.SOP_INGESTED'));
  // Version replacement is clean
  await MockAPI.ingestSopDocument(tokAdmin, { text: newDoc, version: '2.1', replaceVersion: true });
  check('re-ingesting a version replaces it (no duplicates)',
    DB.sopChunks.filter(c => c.version === '2.1').length === 2);

  console.log('\n=== 7. Retrieval quality: threshold blocks irrelevant matches ===');
  const junk = CopilotSOP.retrieveSopChunks('zyxqwv unrelated gibberish kjk');
  check('gibberish query retrieves nothing (similarity threshold)', junk.length === 0);

  console.log(`\n=========================================`);
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('AI copilot test suite crashed:', err);
  process.exit(1);
});
