import type { JobInclusionResult, VariableContext } from '../types';
import { isPlainObject } from './typeGuards';

// Pipeline-phase variables that are NOT available during rule evaluation (Pre-pipeline phase).
// Per docs/SIMULATION.md: CI_PIPELINE_TRIGGERED is Pipeline-phase only.
const RULE_INVISIBLE_VARS = new Set(['CI_PIPELINE_TRIGGERED']);

interface IfEvalResult {
  matched: boolean;
  warning?: string;
}

export function evaluateIfExpression(expr: string, variables: VariableContext): IfEvalResult {
  const ruleVars: VariableContext = {};
  for (const [k, v] of Object.entries(variables)) {
    if (!RULE_INVISIBLE_VARS.has(k)) ruleVars[k] = v;
  }

  try {
    const tokens = tokenize(expr);
    const parser = new Parser(tokens);
    const ast = parser.parseExpr();
    if (!parser.atEnd()) {
      throw new ParseError('Unexpected trailing input');
    }
    const value = evaluate(ast, ruleVars);
    return { matched: toBool(value) };
  } catch {
    return { matched: true, warning: `Expression could not be evaluated: ${expr}` };
  }
}

export function evaluateJobInclusion(
  job: Record<string, unknown>,
  variables: VariableContext,
): JobInclusionResult {
  if (Array.isArray(job['rules'])) {
    return evaluateRules(job['rules'], variables);
  }

  if (job['only'] !== undefined || job['except'] !== undefined) {
    return evaluateLegacyOnlyExcept(job['only'], job['except'], variables);
  }

  return { included: true, when: 'on_success', warnings: [] };
}

export type WorkflowRulesResult = { blocked: false } | { blocked: true; matchedRule: string };

export function evaluateWorkflowRules(
  workflow: Record<string, unknown> | undefined,
  variables: VariableContext,
): WorkflowRulesResult {
  if (!workflow || !Array.isArray(workflow['rules'])) return { blocked: false };

  for (const rule of workflow['rules']) {
    if (!isPlainObject(rule)) continue;

    const match = ruleMatches(rule, variables);
    if (!match.matches) continue;

    if (rule['when'] === 'never') {
      return { blocked: true, matchedRule: stringifyRule(rule) };
    }
    return { blocked: false };
  }
  return { blocked: false };
}

// ----- internal: rules: array evaluation -----

function evaluateRules(rules: unknown[], variables: VariableContext): JobInclusionResult {
  const warnings: string[] = [];

  for (const rule of rules) {
    if (!isPlainObject(rule)) continue;

    const match = ruleMatches(rule, variables);
    for (const w of match.warnings) {
      if (!warnings.includes(w)) warnings.push(w);
    }
    if (!match.matches) continue;

    return outcomeForMatchedRule(rule, warnings);
  }

  return { included: false, reason: 'no rule matched' };
}

function outcomeForMatchedRule(
  rule: Record<string, unknown>,
  warnings: string[],
): JobInclusionResult {
  const when = typeof rule['when'] === 'string' ? rule['when'] : 'on_success';
  if (when === 'never') {
    return { included: false, reason: `excluded by rule: ${stringifyRule(rule)}` };
  }
  if (when === 'manual') return { included: true, when: 'manual', warnings };
  if (when === 'always') return { included: true, when: 'always', warnings };
  return { included: true, when: 'on_success', warnings };
}

function ruleMatches(
  r: Record<string, unknown>,
  variables: VariableContext,
): { matches: boolean; warnings: string[] } {
  const warnings: string[] = [];
  let matches = true;

  if (typeof r['if'] === 'string') {
    const result = evaluateIfExpression(r['if'], variables);
    if (result.warning) warnings.push(result.warning);
    if (!result.matched) matches = false;
  }

  if (matches && r['changes'] !== undefined) {
    warnings.push('changes: clause treated as true (cannot evaluate without repository context)');
  }
  if (matches && r['exists'] !== undefined) {
    warnings.push('exists: clause treated as true (cannot evaluate without repository context)');
  }

  return { matches, warnings };
}

function stringifyRule(r: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof r['if'] === 'string') parts.push(`if: ${r['if']}`);
  if (r['when'] !== undefined) parts.push(`when: ${JSON.stringify(r['when'])}`);
  if (r['changes'] !== undefined) parts.push('changes: <set>');
  if (r['exists'] !== undefined) parts.push('exists: <set>');
  return parts.join(', ');
}

// ----- legacy only:/except: -----

const REF_KEYWORDS: Record<string, (v: VariableContext) => boolean> = {
  branches: (v) => v['CI_COMMIT_BRANCH'] !== undefined && v['CI_COMMIT_BRANCH'] !== '',
  tags: (v) => v['CI_COMMIT_TAG'] !== undefined && v['CI_COMMIT_TAG'] !== '',
  merge_requests: (v) => v['CI_PIPELINE_SOURCE'] === 'merge_request_event',
  pushes: (v) => v['CI_PIPELINE_SOURCE'] === 'push',
  schedules: (v) => v['CI_PIPELINE_SOURCE'] === 'schedule',
  web: (v) => v['CI_PIPELINE_SOURCE'] === 'web',
  api: (v) => v['CI_PIPELINE_SOURCE'] === 'api',
  triggers: (v) => v['CI_PIPELINE_SOURCE'] === 'trigger',
};

function evaluateLegacyOnlyExcept(
  only: unknown,
  except: unknown,
  variables: VariableContext,
): JobInclusionResult {
  const warnings: string[] = [];

  if (only !== undefined) {
    const r = matchOnlyExceptBlock(only, variables);
    for (const w of r.warnings) warnings.push(w);
    if (!r.matches) {
      return { included: false, reason: 'excluded by only:' };
    }
  }

  if (except !== undefined) {
    const r = matchOnlyExceptBlock(except, variables);
    for (const w of r.warnings) warnings.push(w);
    if (r.matches) {
      return { included: false, reason: 'excluded by except:' };
    }
  }

  return { included: true, when: 'on_success', warnings };
}

function matchOnlyExceptBlock(
  block: unknown,
  variables: VariableContext,
): { matches: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const normalized = normalizeOnlyExceptBlock(block);
  if (!normalized) return { matches: false, warnings };

  // AND between keys, OR within each key.
  for (const [key, value] of Object.entries(normalized)) {
    if (!matchOnlyExceptKey(key, value, variables, warnings)) {
      return { matches: false, warnings };
    }
  }
  return { matches: true, warnings };
}

function normalizeOnlyExceptBlock(block: unknown): Record<string, unknown> | null {
  if (Array.isArray(block)) return { refs: block };
  if (isPlainObject(block)) return block;
  return null;
}

function matchOnlyExceptKey(
  key: string,
  value: unknown,
  variables: VariableContext,
  warnings: string[],
): boolean {
  if (key === 'kubernetes') {
    warnings.push('only:/except: kubernetes: treated as true (cannot evaluate client-side)');
    return true;
  }
  if (key === 'refs') {
    return Array.isArray(value) && matchRefsList(value, variables);
  }
  if (key === 'variables') {
    return Array.isArray(value) && matchVariablesList(value, variables, warnings);
  }
  if (key === 'changes') {
    warnings.push('changes: clause treated as true (cannot evaluate without repository context)');
  }
  // Other keys are conservatively treated as true.
  return true;
}

function matchVariablesList(
  exprs: unknown[],
  variables: VariableContext,
  warnings: string[],
): boolean {
  for (const expr of exprs) {
    if (typeof expr !== 'string') continue;
    const r = evaluateIfExpression(expr, variables);
    if (r.warning) warnings.push(r.warning);
    if (r.matched) return true;
  }
  return false;
}

function matchRefsList(refs: unknown[], variables: VariableContext): boolean {
  for (const r of refs) {
    if (typeof r !== 'string') continue;
    const keyword = REF_KEYWORDS[r];
    if (keyword) {
      if (keyword(variables)) return true;
      continue;
    }
    // Treat as ref pattern (regex) against branch or tag.
    const target = variables['CI_COMMIT_BRANCH'] ?? variables['CI_COMMIT_TAG'] ?? '';
    try {
      const re = parseRefPattern(r);
      if (re.test(target)) return true;
    } catch {
      // Unparseable — skip.
    }
  }
  return false;
}

function parseRefPattern(s: string): RegExp {
  // GitLab supports /regex/ literals or bare strings (treated as exact match).
  const slashMatch = /^\/(.+)\/([imsx]*)$/.exec(s);
  if (slashMatch) {
    const pattern = slashMatch[1] ?? '';
    const flags = (slashMatch[2] ?? '').includes('i') ? 'i' : '';
    return new RegExp(pattern, flags);
  }
  // Bare string: anchor for exact-match-by-default.
  const escaped = s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  return new RegExp(`^${escaped}$`);
}

// ===== if: expression parser =====

class ParseError extends Error {}

type Token =
  | { kind: 'op'; value: '==' | '!=' | '=~' | '!~' | '&&' | '||' | '!' | '(' | ')' }
  | { kind: 'var'; name: string }
  | { kind: 'string'; value: string }
  | { kind: 'regex'; pattern: string; flags: string }
  | { kind: 'null' };

const TWO_CHAR_OPS: Record<string, '&&' | '||' | '==' | '!=' | '=~' | '!~'> = {
  '&&': '&&',
  '||': '||',
  '==': '==',
  '!=': '!=',
  '=~': '=~',
  '!~': '!~',
};

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const c = input[i];
    if (c === undefined) break;

    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }

    const opLen = readOperator(input, i, tokens);
    if (opLen > 0) {
      i += opLen;
      continue;
    }

    if (c === '$') {
      i = readVariable(input, i, tokens);
      continue;
    }

    if (c === '"' || c === "'") {
      i = readString(input, i, c, tokens);
      continue;
    }

    if (c === '/') {
      i = readRegex(input, i, tokens);
      continue;
    }

    if (/[A-Za-z_]/.test(c)) {
      i = readIdentifier(input, i, tokens);
      continue;
    }

    throw new ParseError(`Unexpected character: ${c}`);
  }

  return tokens;
}

function readOperator(input: string, i: number, tokens: Token[]): number {
  const c = input[i];
  if (c === '(' || c === ')') {
    tokens.push({ kind: 'op', value: c });
    return 1;
  }
  const two = input.slice(i, i + 2);
  const op = TWO_CHAR_OPS[two];
  if (op) {
    tokens.push({ kind: 'op', value: op });
    return 2;
  }
  if (c === '!') {
    tokens.push({ kind: 'op', value: '!' });
    return 1;
  }
  return 0;
}

function readVariable(input: string, i: number, tokens: Token[]): number {
  let j = i + 1;
  while (j < input.length && /\w/.test(input[j] ?? '')) j++;
  const name = input.slice(i + 1, j);
  if (!name) throw new ParseError('Empty variable name');
  tokens.push({ kind: 'var', name });
  return j;
}

function readString(input: string, i: number, quote: string, tokens: Token[]): number {
  let j = i + 1;
  while (j < input.length && input[j] !== quote) j++;
  if (j >= input.length) throw new ParseError('Unterminated string');
  tokens.push({ kind: 'string', value: input.slice(i + 1, j) });
  return j + 1;
}

function readRegex(input: string, i: number, tokens: Token[]): number {
  // Regex literal /pattern/flags. Greedy match; allow escaped slashes.
  let j = i + 1;
  while (j < input.length) {
    const ch = input[j];
    if (ch === '\\' && j + 1 < input.length) {
      j += 2;
      continue;
    }
    if (ch === '/') break;
    j++;
  }
  if (j >= input.length) throw new ParseError('Unterminated regex');
  const pattern = input.slice(i + 1, j);
  let k = j + 1;
  const flagsStart = k;
  while (k < input.length && /[a-z]/i.test(input[k] ?? '')) k++;
  tokens.push({ kind: 'regex', pattern, flags: input.slice(flagsStart, k) });
  return k;
}

function readIdentifier(input: string, i: number, tokens: Token[]): number {
  let j = i;
  while (j < input.length && /\w/.test(input[j] ?? '')) j++;
  const word = input.slice(i, j);
  if (word === 'null') {
    tokens.push({ kind: 'null' });
    return j;
  }
  throw new ParseError(`Unexpected identifier: ${word}`);
}

type ASTNode =
  | { kind: 'or'; left: ASTNode; right: ASTNode }
  | { kind: 'and'; left: ASTNode; right: ASTNode }
  | { kind: 'not'; operand: ASTNode }
  | { kind: 'compare'; op: '==' | '!=' | '=~' | '!~'; left: ValueNode; right: ValueNode }
  | { kind: 'value'; value: ValueNode };

type ValueNode =
  | { kind: 'var'; name: string }
  | { kind: 'string'; value: string }
  | { kind: 'regex'; pattern: string; flags: string }
  | { kind: 'null' };

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  atEnd(): boolean {
    return this.pos >= this.tokens.length;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    const t = this.tokens[this.pos];
    if (!t) throw new ParseError('Unexpected end of input');
    this.pos++;
    return t;
  }

  parseExpr(): ASTNode {
    return this.parseOr();
  }

  private parseOr(): ASTNode {
    let left = this.parseAnd();
    for (;;) {
      const t = this.peek();
      if (t?.kind === 'op' && t.value === '||') {
        this.consume();
        const right = this.parseAnd();
        left = { kind: 'or', left, right };
      } else break;
    }
    return left;
  }

  private parseAnd(): ASTNode {
    let left = this.parseUnary();
    for (;;) {
      const t = this.peek();
      if (t?.kind === 'op' && t.value === '&&') {
        this.consume();
        const right = this.parseUnary();
        left = { kind: 'and', left, right };
      } else break;
    }
    return left;
  }

  private parseUnary(): ASTNode {
    const t = this.peek();
    if (t?.kind === 'op' && t.value === '!') {
      this.consume();
      return { kind: 'not', operand: this.parseUnary() };
    }
    return this.parseComparison();
  }

  private parseComparison(): ASTNode {
    const t = this.peek();
    if (t?.kind === 'op' && t.value === '(') {
      this.consume();
      const inner = this.parseExpr();
      const close = this.peek();
      if (close?.kind !== 'op' || close.value !== ')') {
        throw new ParseError('Expected closing parenthesis');
      }
      this.consume();
      return inner;
    }

    const left = this.parseValue();
    const op = this.peek();
    if (
      op?.kind === 'op' &&
      (op.value === '==' || op.value === '!=' || op.value === '=~' || op.value === '!~')
    ) {
      this.consume();
      const right = this.parseValue();
      return { kind: 'compare', op: op.value, left, right };
    }
    return { kind: 'value', value: left };
  }

  private parseValue(): ValueNode {
    const t = this.consume();
    if (t.kind === 'var') return { kind: 'var', name: t.name };
    if (t.kind === 'string') return { kind: 'string', value: t.value };
    if (t.kind === 'regex') return { kind: 'regex', pattern: t.pattern, flags: t.flags };
    if (t.kind === 'null') return { kind: 'null' };
    throw new ParseError('Expected value');
  }
}

type RuntimeValue =
  | { kind: 'string'; value: string }
  | { kind: 'null' }
  | { kind: 'regex'; pattern: string; flags: string };

function evalValue(v: ValueNode, vars: VariableContext): RuntimeValue {
  if (v.kind === 'var') {
    const looked = vars[v.name];
    if (looked === undefined) return { kind: 'null' };
    return { kind: 'string', value: looked };
  }
  if (v.kind === 'string') return { kind: 'string', value: v.value };
  if (v.kind === 'regex') return { kind: 'regex', pattern: v.pattern, flags: v.flags };
  return { kind: 'null' };
}

function toBool(v: RuntimeValue | boolean): boolean {
  if (typeof v === 'boolean') return v;
  if (v.kind === 'null') return false;
  if (v.kind === 'string') return v.value !== '';
  // A bare regex value is truthy (non-null), per Ruby-ish semantics.
  return true;
}

function evaluate(node: ASTNode, vars: VariableContext): RuntimeValue | boolean {
  switch (node.kind) {
    case 'or':
      return toBool(evaluate(node.left, vars)) || toBool(evaluate(node.right, vars));
    case 'and':
      return toBool(evaluate(node.left, vars)) && toBool(evaluate(node.right, vars));
    case 'not':
      return !toBool(evaluate(node.operand, vars));
    case 'value':
      return evalValue(node.value, vars);
    case 'compare': {
      const left = evalValue(node.left, vars);
      const right = evalValue(node.right, vars);
      return compare(node.op, left, right);
    }
  }
}

function compare(op: '==' | '!=' | '=~' | '!~', left: RuntimeValue, right: RuntimeValue): boolean {
  if (op === '==') return compareEquals(left, right);
  if (op === '!=') return !compareEquals(left, right);
  return compareRegex(op, left, right);
}

function compareEquals(left: RuntimeValue, right: RuntimeValue): boolean {
  if (left.kind === 'null' && right.kind === 'null') return true;
  if (left.kind === 'null' || right.kind === 'null') return false;
  if (left.kind === 'string' && right.kind === 'string') return left.value === right.value;
  return false;
}

function compareRegex(op: '=~' | '!~', left: RuntimeValue, right: RuntimeValue): boolean {
  const re = regexFromRuntime(right);
  if (!re) return op === '!~';
  const subject = left.kind === 'string' ? left.value : '';
  const matched = re.test(subject);
  return op === '=~' ? matched : !matched;
}

function regexFromRuntime(value: RuntimeValue): RegExp | null {
  if (value.kind === 'regex') return buildRegex(value.pattern, value.flags);
  if (value.kind === 'string') {
    // Variable RHS: its content may itself be a /pattern/flags literal, or a raw pattern.
    const m = /^\/(.*)\/([a-z]*)$/.exec(value.value);
    if (m) return buildRegex(m[1] ?? '', m[2] ?? '');
    return buildRegex(value.value, '');
  }
  return null;
}

function buildRegex(pattern: string, flags: string): RegExp {
  // Only `i` flag is supported per GitLab/RE2 limitation.
  const safeFlags = flags.includes('i') ? 'i' : '';
  return new RegExp(pattern, safeFlags);
}
