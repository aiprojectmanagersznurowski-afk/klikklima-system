#!/usr/bin/env node
/**
 * PreToolUse (Edit|Write|NotebookEdit) — granice zapisu per rola agenta.
 *
 * Wywoływany z frontmattera agenta:
 *   command: "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/guard-paths.mjs\" test-author"
 *
 * Dlaczego to jest istotne: bez tego implementer, który nie potrafi przejść testu,
 * po prostu poprawi test. Widziałem to tyle razy, ile razy tego nie zablokowano.
 * Prompt jest sugestią, exit 2 jest faktem.
 *
 * Wejście: JSON na stdin (tool_name, tool_input.file_path).
 * Wyjście: exit 0 = przepuść, exit 2 = zablokuj (stderr trafia do agenta jako powód).
 */
import { readFileSync } from 'node:fs';
import { relative, isAbsolute } from 'node:path';

const PROJECT = process.env.CLAUDE_PROJECT_DIR || process.cwd();

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0); // nie blokuj z powodu własnego błędu parsowania
}

// Rola efektywna: payload PreToolUse zna subagenta, argv jest fallbackiem dla wątku głównego.
const role = input?.agent_type || input?.agent_name || process.argv[2] || 'unknown';
const raw = input?.tool_input?.file_path || input?.tool_input?.notebook_path || '';
if (!raw) process.exit(0);

const rel = (isAbsolute(raw) ? relative(PROJECT, raw) : raw).replace(/\\/g, '/');

const load = async () => {
  try {
    const mod = await import(`file://${PROJECT}/tools/kk.config.mjs`);
    return mod.config;
  } catch {
    return null;
  }
};

const cfg = await load();
if (!cfg) process.exit(0); // brak konfiguracji => nie udawaj, że pilnujesz

const matches = (path, patterns) =>
  patterns.some((p) => {
    if (p.includes('**')) {
      const re = new RegExp('^' + p.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return re.test(path);
    }
    return path.startsWith(p) || path.includes(p);
  });

const deny = (msg) => {
  process.stderr.write(`[guard-paths / ${role}] ZABLOKOWANO zapis do: ${rel}\n${msg}\n`);
  process.exit(2);
};

// 1. Ścieżki kontraktowe — tylko contract-steward i tylko przy otwartym oknie kontraktowym
if (matches(rel, cfg.contractProtectedPaths)) {
  if (role !== 'contract-steward') {
    deny(
      `To jest ścieżka kontraktowa. Zmiana kontraktu jest decyzją architektoniczną, nie skutkiem ubocznym implementacji.\n` +
      `Opisz potrzebną zmianę w Work Order i zakończ turę — człowiek uruchomi /kk-contract.`
    );
  }
  let open = false;
  try {
    const token = JSON.parse(readFileSync(`${PROJECT}/${cfg.stateDir}/contract-window.json`, 'utf8'));
    open = new Date(token.expiresAt).getTime() > Date.now();
  } catch { open = false; }
  if (!open) {
    deny(
      `Okno kontraktowe jest zamknięte. Człowiek musi je otworzyć świadomie:\n` +
      `    node tools/kk-contract-window.mjs open <TICKET>\n` +
      `Kontrakt jest jedyną rzeczą w tym systemie, której agent nie zmienia sam.`
    );
  }
}

// 2. Pliki testowe — implementerom nie wolno ich dotykać
const isTest = cfg.testPathPatterns.some((p) => rel.includes(p));
if (isTest && role.startsWith('implementer')) {
  deny(
    `Implementer nie edytuje testów. Jeżeli test jest błędny, zgłoś to jako TEST-DEFECT w podsumowaniu\n` +
    `i zakończ turę — test poprawi agent test-author, a decyzję podejmie człowiek.`
  );
}

// 3. Kod produkcyjny — test-authorowi nie wolno go dotykać
if (!isTest && role === 'test-author' && !matches(rel, cfg.agentWriteScopes['test-author'] || [])) {
  deny(
    `test-author pisze wyłącznie testy. Nie „popraw przy okazji" implementacji —\n` +
    `bramka RED wymaga, aby test padał z powodu braku implementacji, a nie dlatego, że sam ją napisałeś.`
  );
}

// 4. Ogólny zakres roli
const scope = cfg.agentWriteScopes[role];
if (scope && !matches(rel, scope)) {
  deny(`Rola "${role}" ma zakres zapisu: ${scope.join(', ')}.\nJeżeli zadanie naprawdę wymaga tej ścieżki, to znaczy, że trafiło do złego agenta.`);
}

process.exit(0);
