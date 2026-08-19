#!/usr/bin/env node
/**
 * kk-port-antigravity — generuje konfigurację Antigravity z konfiguracji Claude Code.
 *
 * Dlaczego generator, a nie ręczna kopia: dwa zestawy definicji agentów rozjadą się
 * przy pierwszej zmianie, a rozjazd między IDE jest gorszy niż brak drugiego IDE —
 * zespół przestaje wiedzieć, która wersja obowiązuje.
 *
 * Źródło prawdy: .claude/agents/*.md, .claude/commands/*.md, .claude/CLAUDE.md
 * Cel:           .agents/agents/*.md, .agents/workflows/*.md, .agents/rules/*.md
 *
 * Użycie:
 *   node tools/kk-port-antigravity.mjs           # generuj
 *   node tools/kk-port-antigravity.mjs --check   # wykryj dryf (exit 1)
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.KK_PROJECT_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const RULES_CHAR_LIMIT = 12000; // twardy limit Antigravity na plik reguł

// Baner MUSI iść po bloku frontmattera. Frontmatter YAML jest rozpoznawany tylko wtedy,
// gdy `---` stoi w pierwszej linii pliku — komentarz przed nim sprawia, że Antigravity
// traktuje cały plik jako zwykły markdown i ignoruje model, narzędzia oraz uprawnienia.
const BANNER = (src) => `<!-- WYGENEROWANE z ${src} przez tools/kk-port-antigravity.mjs — nie edytuj ręcznie. -->\n`;

/** Mapowanie modeli: Claude Code -> Antigravity (inherit | flash | pro) */
const MODEL = { opus: 'pro', sonnet: 'flash', haiku: 'flash' };

/** Mapowanie narzędzi: Claude Code -> Antigravity */
const TOOLS = {
  Read: 'view_file', Glob: 'find_by_name', Grep: 'grep_search',
  Write: 'write_to_file', Edit: 'replace_file_content', MultiEdit: 'multi_replace_file_content',
  Bash: 'run_command', Task: 'invoke_subagent', WebSearch: 'search_web', WebFetch: 'read_url_content',
};

const parse = (text) => {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) return { fm: {}, body: text };
  const fm = {};
  let key = null;
  for (const line of m[1].split('\n')) {
    const kv = /^([a-zA-Z_-]+):\s*(.*)$/.exec(line);
    if (kv) {
      key = kv[1];
      const v = kv[2].trim();
      if (v.startsWith('[') && v.endsWith(']')) {
        fm[key] = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      } else if (v) {
        fm[key] = v.replace(/^["']|["']$/g, '');
      } else {
        fm[key] = [];
      }
    } else if (/^\s+-\s+/.test(line) && key) {
      if (!Array.isArray(fm[key])) fm[key] = [];
      fm[key].push(line.replace(/^\s+-\s+/, '').trim().replace(/^["']|["']$/g, ''));
    }
  }
  return { fm, body: m[2] };
};

const files = {};

// ── agenci ────────────────────────────────────────────────────────────────
const agentsDir = join(ROOT, '.claude/agents');
for (const f of readdirSync(agentsDir).filter((x) => x.endsWith('.md')).sort()) {
  const { fm, body } = parse(readFileSync(join(agentsDir, f), 'utf8'));
  const src = Array.isArray(fm.tools) ? fm.tools : String(fm.tools || '').split(',').map((s) => s.trim()).filter(Boolean);
  const tools = [...new Set(src.map((t) => TOOLS[t]).filter(Boolean))];
  const readOnly = !tools.includes('write_to_file') && !tools.includes('replace_file_content');

  const front = [
    '---',
    `name: ${fm.name || basename(f, '.md')}`,
    `description: ${fm.description || ''}`,
    'tools:',
    ...tools.map((t) => `  - ${t}`),
    'subagent: true',
    `mainAgent: ${fm.name === 'spec-analyst' ? 'true' : 'false'}`,
    `model: ${MODEL[fm.model] || 'inherit'}`,
    // Cytowane celowo: w YAML 1.1 gołe `off` parsuje się jako wartość logiczna false,
    // a nie jako łańcuch "off" — polityka wykonywania komend cicho by zniknęła.
    // `sandbox` dostaje każdy agent z run_command: recenzent musi móc uruchomić verify.sh,
    // a e2e-runner testy. Niebezpieczne komendy i tak zatrzymuje guard-bash.
    `commandExecutionPolicy: ${tools.includes('run_command') ? 'sandbox' : '"off"'}`,
    ...(Array.isArray(fm.skills) && fm.skills.length
      ? ['skills:', ...fm.skills.map((s) => `  - skills/${s}`)] : []),
    '---',
    '',
  ].join('\n');

  const note = readOnly
    ? '\n> **Ten agent jest tylko do odczytu.** Nie ma narzędzi zapisu ani wykonywania komend — jeżeli uznasz, że trzeba coś zmienić, opisz to w podsumowaniu zamiast próbować zapisać.\n'
    : '\n> **Rozdział ról w Antigravity jest słabszy niż w Claude Code.** Hook nie zna Twojej nazwy, więc granice zapisu per rola nie są egzekwowane przy zapisie pliku. Po zakończeniu pracy uruchom `node tools/kk-phase.mjs <red|green>` — sprawdzi, czy zmienione pliki mieszczą się w Twojej fazie.\n';

  files[`.agents/agents/${f}`] = front + BANNER(`.claude/agents/${f}`) + body.trimEnd() + '\n' + note;
}

// ── workflowy (z komend slash) ────────────────────────────────────────────
const cmdDir = join(ROOT, '.claude/commands');
for (const f of readdirSync(cmdDir).filter((x) => x.endsWith('.md')).sort()) {
  const { fm, body } = parse(readFileSync(join(cmdDir, f), 'utf8'));
  const desc = (fm.description || '').replace(/\n/g, ' ');
  const converted = body
    .replace(/\$ARGUMENTS/g, '{{args}}')
    .replace(/\bsubagent\b/gi, 'subagent (invoke_subagent)')
    .replace(/\.claude\/agents\//g, '.agents/agents/');
  files[`.agents/workflows/${f}`] =
    `---\ndescription: ${desc}\n---\n\n` + BANNER(`.claude/commands/${f}`) + converted.trimEnd() + '\n';
}

// ── reguły (z CLAUDE.md, dzielone na pliki poniżej limitu) ────────────────
const claudeMd = readFileSync(join(ROOT, '.claude/CLAUDE.md'), 'utf8');
const sections = claudeMd.split(/\n(?=## )/);
const head = sections.shift();

const buckets = [{ name: '00-kk-core', parts: [head] }];
for (const sec of sections) {
  const last = buckets[buckets.length - 1];
  const size = last.parts.join('\n').length;
  if (size + sec.length > RULES_CHAR_LIMIT - 800) {
    buckets.push({ name: `${String(buckets.length).padStart(2, '0')}-kk-rules`, parts: [sec] });
  } else {
    last.parts.push(sec);
  }
}
for (const b of buckets) {
  const content = BANNER('.claude/CLAUDE.md') + b.parts.join('\n').trimEnd() + '\n';
  if (content.length > RULES_CHAR_LIMIT) {
    console.error(`  ✗ ${b.name}.md ma ${content.length} znaków, limit Antigravity to ${RULES_CHAR_LIMIT}.`);
    process.exit(1);
  }
  files[`.agents/rules/${b.name}.md`] = content;
}

// ── zapis albo kontrola dryfu ─────────────────────────────────────────────
let drift = 0;
for (const [rel, content] of Object.entries(files)) {
  const abs = join(ROOT, rel);
  if (CHECK) {
    const cur = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
    if (cur !== content) { console.log(`  ✗ DRYF: ${rel}`); drift++; }
  } else {
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
}

if (CHECK) {
  if (drift) {
    console.log(`\n  ${drift} plik(ów) Antigravity rozjechało się z konfiguracją Claude Code.`);
    console.log('  Uruchom: node tools/kk-port-antigravity.mjs');
    process.exit(1);
  }
  console.log(`  ✓ Konfiguracja Antigravity zgodna z Claude Code (${Object.keys(files).length} plików).`);
  process.exit(0);
}

const byKind = (p) => Object.keys(files).filter((f) => f.includes(p)).length;
console.log(`  ✓ Wygenerowano ${Object.keys(files).length} plików:`);
console.log(`      .agents/agents/    ${byKind('/agents/')} agentów`);
console.log(`      .agents/workflows/ ${byKind('/workflows/')} workflowów`);
console.log(`      .agents/rules/     ${byKind('/rules/')} plików reguł`);
