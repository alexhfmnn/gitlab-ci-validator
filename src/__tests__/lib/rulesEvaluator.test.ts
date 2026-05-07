import { describe, expect, it } from 'vitest';
import {
  evaluateIfExpression,
  evaluateJobInclusion,
  evaluateWorkflowRules,
} from '../../lib/rulesEvaluator';
import type { VariableContext } from '../../types';

describe('evaluateIfExpression', () => {
  const vars: VariableContext = {
    CI_COMMIT_BRANCH: 'main',
    CI_DEFAULT_BRANCH: 'main',
    CI_PIPELINE_SOURCE: 'push',
    CI_MERGE_REQUEST_DRAFT: 'true',
  };

  it('matches simple equality', () => {
    expect(evaluateIfExpression('$CI_COMMIT_BRANCH == "main"', vars).matched).toBe(true);
    expect(evaluateIfExpression('$CI_COMMIT_BRANCH == "dev"', vars).matched).toBe(false);
  });

  it('matches inequality with null when var is missing', () => {
    expect(evaluateIfExpression('$CI_NOT_SET == null', vars).matched).toBe(true);
    expect(evaluateIfExpression('$CI_NOT_SET != null', vars).matched).toBe(false);
  });

  it('matches regex literal RHS', () => {
    expect(evaluateIfExpression('$CI_COMMIT_BRANCH =~ /^main$/', vars).matched).toBe(true);
    expect(evaluateIfExpression('$CI_COMMIT_BRANCH !~ /^dev/', vars).matched).toBe(true);
  });

  it('combines && and ||', () => {
    expect(
      evaluateIfExpression('$CI_COMMIT_BRANCH == "main" && $CI_PIPELINE_SOURCE == "push"', vars)
        .matched,
    ).toBe(true);
    expect(
      evaluateIfExpression('$CI_COMMIT_BRANCH == "feature" || $CI_PIPELINE_SOURCE == "push"', vars)
        .matched,
    ).toBe(true);
  });

  it('handles parentheses + negation', () => {
    expect(
      evaluateIfExpression(
        '!($CI_COMMIT_BRANCH == "feature") && $CI_PIPELINE_SOURCE == "push"',
        vars,
      ).matched,
    ).toBe(true);
  });

  it('truthy bare variable reference', () => {
    expect(evaluateIfExpression('$CI_COMMIT_BRANCH', vars).matched).toBe(true);
    expect(evaluateIfExpression('$CI_DOES_NOT_EXIST', vars).matched).toBe(false);
  });

  it('returns warning + matched=true on parse errors (conservative)', () => {
    const r = evaluateIfExpression('$$$ broken @@@', vars);
    expect(r.matched).toBe(true);
    expect(r.warning).toBeDefined();
  });

  it('hides CI_PIPELINE_TRIGGERED at rule-eval time', () => {
    const v: VariableContext = { CI_PIPELINE_TRIGGERED: 'true' };
    expect(evaluateIfExpression('$CI_PIPELINE_TRIGGERED == "true"', v).matched).toBe(false);
  });
});

describe('evaluateJobInclusion — rules:', () => {
  const vars: VariableContext = { CI_COMMIT_BRANCH: 'main', CI_DEFAULT_BRANCH: 'main' };

  it('includes job on first matching rule', () => {
    const r = evaluateJobInclusion({ rules: [{ if: '$CI_COMMIT_BRANCH == "main"' }] }, vars);
    expect(r).toMatchObject({ included: true, when: 'on_success' });
  });

  it('excludes job when matching rule has when:never', () => {
    const r = evaluateJobInclusion(
      { rules: [{ if: '$CI_COMMIT_BRANCH == "main"', when: 'never' }] },
      vars,
    );
    expect(r.included).toBe(false);
  });

  it('honours when:manual', () => {
    const r = evaluateJobInclusion(
      { rules: [{ if: '$CI_COMMIT_BRANCH == "main"', when: 'manual' }] },
      vars,
    );
    expect(r).toMatchObject({ included: true, when: 'manual' });
  });

  it('honours when:always', () => {
    const r = evaluateJobInclusion(
      { rules: [{ if: '$CI_COMMIT_BRANCH == "main"', when: 'always' }] },
      vars,
    );
    expect(r).toMatchObject({ included: true, when: 'always' });
  });

  it('falls through unmatched rules and excludes when none matches', () => {
    const r = evaluateJobInclusion(
      {
        rules: [{ if: '$CI_COMMIT_BRANCH == "feature"' }, { if: '$CI_COMMIT_BRANCH == "develop"' }],
      },
      vars,
    );
    expect(r.included).toBe(false);
  });

  it('emits a warning for changes: clauses', () => {
    const r = evaluateJobInclusion(
      { rules: [{ if: '$CI_COMMIT_BRANCH == "main"', changes: ['src/**/*'] }] },
      vars,
    );
    if (r.included) {
      expect(r.warnings.some((w) => w.includes('changes:'))).toBe(true);
    } else {
      throw new Error('expected included');
    }
  });
});

describe('evaluateJobInclusion — only/except (legacy)', () => {
  const branch: VariableContext = {
    CI_COMMIT_BRANCH: 'main',
    CI_PIPELINE_SOURCE: 'push',
  };
  const tag: VariableContext = {
    CI_COMMIT_TAG: 'v1.0.0',
    CI_PIPELINE_SOURCE: 'push',
  };

  it('only: branches matches a branch', () => {
    expect(evaluateJobInclusion({ only: ['branches'] }, branch).included).toBe(true);
    expect(evaluateJobInclusion({ only: ['branches'] }, tag).included).toBe(false);
  });

  it('only: tags matches a tag', () => {
    expect(evaluateJobInclusion({ only: ['tags'] }, tag).included).toBe(true);
    expect(evaluateJobInclusion({ only: ['tags'] }, branch).included).toBe(false);
  });

  it('only with regex pattern matches branch by regex', () => {
    expect(evaluateJobInclusion({ only: ['/^main$/'] }, branch).included).toBe(true);
    expect(evaluateJobInclusion({ only: ['/^dev$/'] }, branch).included).toBe(false);
  });

  it('except excludes a matching ref', () => {
    expect(evaluateJobInclusion({ only: ['branches'], except: ['main'] }, branch).included).toBe(
      false,
    );
  });
});

describe('evaluateIfExpression — regex RHS via variable', () => {
  it('matches when the variable RHS holds a /pattern/flags literal', () => {
    expect(
      evaluateIfExpression('$BRANCH =~ $PATTERN', {
        BRANCH: 'release/1.0',
        PATTERN: String.raw`/^release\/.+$/`,
      }).matched,
    ).toBe(true);
  });

  it('treats a non-literal variable RHS as a raw pattern', () => {
    expect(
      evaluateIfExpression('$BRANCH =~ $PATTERN', {
        BRANCH: 'feature-x',
        PATTERN: 'feature',
      }).matched,
    ).toBe(true);
  });

  it('returns op==="!~" when the RHS is null (variable missing)', () => {
    const r = evaluateIfExpression('$X !~ $MISSING', { X: 'val' });
    expect(r.matched).toBe(true);
  });

  it('parses regex literal with /i flag (case-insensitive)', () => {
    expect(evaluateIfExpression('$X =~ /^foo$/i', { X: 'FOO' }).matched).toBe(true);
  });
});

describe('evaluateIfExpression — parser/tokenize edge cases', () => {
  it('treats trailing input as a parse error (warning)', () => {
    const r = evaluateIfExpression('$X $Y', { X: 'a', Y: 'b' });
    expect(r.matched).toBe(true);
    expect(r.warning).toBeDefined();
  });

  it('treats unknown identifier as a parse error (warning)', () => {
    const r = evaluateIfExpression('foo == "bar"', {});
    expect(r.matched).toBe(true);
    expect(r.warning).toBeDefined();
  });

  it('treats parseValue on a stray operator as a parse error', () => {
    const r = evaluateIfExpression('() == "a"', {});
    expect(r.matched).toBe(true);
    expect(r.warning).toBeDefined();
  });

  it('treats unclosed parenthesis as a parse error', () => {
    const r = evaluateIfExpression('($X == "a"', { X: 'a' });
    expect(r.matched).toBe(true);
    expect(r.warning).toBeDefined();
  });

  it('treats empty variable name ($) as a parse error', () => {
    const r = evaluateIfExpression('$ == "a"', {});
    expect(r.matched).toBe(true);
    expect(r.warning).toBeDefined();
  });

  it('treats unterminated string as a parse error', () => {
    const r = evaluateIfExpression('"unterminated', {});
    expect(r.matched).toBe(true);
    expect(r.warning).toBeDefined();
  });

  it('treats unterminated regex as a parse error', () => {
    const r = evaluateIfExpression('$X =~ /no-end', { X: 'val' });
    expect(r.matched).toBe(true);
    expect(r.warning).toBeDefined();
  });

  it('treats an unexpected character as a parse error', () => {
    const r = evaluateIfExpression('$X @', { X: 'a' });
    expect(r.matched).toBe(true);
    expect(r.warning).toBeDefined();
  });

  it('parses regex with escaped slash', () => {
    expect(
      evaluateIfExpression(String.raw`$BRANCH =~ /release\/.+/`, { BRANCH: 'release/1.0' }).matched,
    ).toBe(true);
  });

  it('treats parentheses around an expression', () => {
    expect(evaluateIfExpression('($X == "a")', { X: 'a' }).matched).toBe(true);
  });

  it('returns true for a bare regex literal (truthy regex value)', () => {
    expect(evaluateIfExpression('/anything/', {}).matched).toBe(true);
  });

  it('== between string and regex returns false', () => {
    expect(evaluateIfExpression('$X == /abc/', { X: 'abc' }).matched).toBe(false);
  });

  it('!= between regex and null returns true', () => {
    expect(evaluateIfExpression('/abc/ != null', {}).matched).toBe(true);
  });
});

describe('evaluateJobInclusion — rules with exists:', () => {
  it('emits a warning when exists: is set', () => {
    const r = evaluateJobInclusion(
      { rules: [{ if: '$CI_COMMIT_BRANCH == "main"', exists: ['Dockerfile'] }] },
      { CI_COMMIT_BRANCH: 'main' },
    );
    if (!r.included) throw new Error('expected included');
    expect(r.warnings.some((w) => w.includes('exists:'))).toBe(true);
  });
});

describe('evaluateJobInclusion — only: object form and ref keywords', () => {
  it('matches only:refs object form against a branch keyword', () => {
    const r = evaluateJobInclusion(
      { only: { refs: ['main'] } },
      { CI_COMMIT_BRANCH: 'main', CI_PIPELINE_SOURCE: 'push' },
    );
    expect(r.included).toBe(true);
  });

  it('treats only:variables expressions (any-match)', () => {
    const r = evaluateJobInclusion(
      { only: { variables: ['$DEPLOY == "true"'] } },
      { DEPLOY: 'true', CI_COMMIT_BRANCH: 'main' },
    );
    expect(r.included).toBe(true);
  });

  it('excludes when only:variables expressions all fail', () => {
    const r = evaluateJobInclusion(
      { only: { variables: ['$DEPLOY == "true"'] } },
      { DEPLOY: 'false', CI_COMMIT_BRANCH: 'main' },
    );
    expect(r.included).toBe(false);
  });

  it('warns for only:changes', () => {
    const r = evaluateJobInclusion(
      { only: { refs: ['branches'], changes: ['src/**/*'] } },
      { CI_COMMIT_BRANCH: 'main', CI_PIPELINE_SOURCE: 'push' },
    );
    if (!r.included) throw new Error('expected included');
    expect(r.warnings.some((w) => w.includes('changes:'))).toBe(true);
  });

  it('warns for only:kubernetes', () => {
    const r = evaluateJobInclusion(
      { only: { kubernetes: 'active' } },
      { CI_COMMIT_BRANCH: 'main', CI_PIPELINE_SOURCE: 'push' },
    );
    if (!r.included) throw new Error('expected included');
    expect(r.warnings.some((w) => w.includes('kubernetes'))).toBe(true);
  });

  it('only:variables treats non-array as no match', () => {
    const r = evaluateJobInclusion(
      { only: { variables: 'not-an-array' } },
      { CI_COMMIT_BRANCH: 'main' },
    );
    expect(r.included).toBe(false);
  });

  it('only:refs treats non-array as no match', () => {
    const r = evaluateJobInclusion({ only: { refs: 'main' } }, { CI_COMMIT_BRANCH: 'main' });
    expect(r.included).toBe(false);
  });

  it('only:scalar (non-array, non-object) excludes', () => {
    const r = evaluateJobInclusion({ only: 'main' }, { CI_COMMIT_BRANCH: 'main' });
    expect(r.included).toBe(false);
  });

  it('matches via merge_requests source keyword', () => {
    const r = evaluateJobInclusion(
      { only: ['merge_requests'] },
      { CI_PIPELINE_SOURCE: 'merge_request_event' },
    );
    expect(r.included).toBe(true);
  });

  it('matches via pushes source keyword', () => {
    const r = evaluateJobInclusion(
      { only: ['pushes'] },
      { CI_PIPELINE_SOURCE: 'push', CI_COMMIT_BRANCH: 'main' },
    );
    expect(r.included).toBe(true);
  });

  it('matches via schedules source keyword', () => {
    const r = evaluateJobInclusion(
      { only: ['schedules'] },
      { CI_PIPELINE_SOURCE: 'schedule', CI_COMMIT_BRANCH: 'main' },
    );
    expect(r.included).toBe(true);
  });

  it('matches via web/api/triggers source keywords', () => {
    expect(evaluateJobInclusion({ only: ['web'] }, { CI_PIPELINE_SOURCE: 'web' }).included).toBe(
      true,
    );
    expect(evaluateJobInclusion({ only: ['api'] }, { CI_PIPELINE_SOURCE: 'api' }).included).toBe(
      true,
    );
    expect(
      evaluateJobInclusion({ only: ['triggers'] }, { CI_PIPELINE_SOURCE: 'trigger' }).included,
    ).toBe(true);
  });

  it('falls back to tag for ref pattern matching when no branch is set', () => {
    expect(evaluateJobInclusion({ only: ['/^v[0-9]+/'] }, { CI_COMMIT_TAG: 'v1' }).included).toBe(
      true,
    );
  });

  it('skips non-string entries inside ref lists', () => {
    expect(evaluateJobInclusion({ only: [42, null] }, { CI_COMMIT_BRANCH: 'main' }).included).toBe(
      false,
    );
  });

  it('handles unparseable regex by treating it as no match', () => {
    expect(evaluateJobInclusion({ only: ['/[/'] }, { CI_COMMIT_BRANCH: 'main' }).included).toBe(
      false,
    );
  });
});

describe('evaluateWorkflowRules', () => {
  const vars: VariableContext = { CI_COMMIT_BRANCH: 'main' };

  it('blocks pipeline on first matching when:never', () => {
    const r = evaluateWorkflowRules(
      { rules: [{ if: '$CI_COMMIT_BRANCH == "main"', when: 'never' }] },
      vars,
    );
    expect(r.blocked).toBe(true);
  });

  it('does not block when first matching rule allows', () => {
    const r = evaluateWorkflowRules({ rules: [{ if: '$CI_COMMIT_BRANCH == "main"' }] }, vars);
    expect(r.blocked).toBe(false);
  });

  it('returns blocked:false when workflow is undefined', () => {
    expect(evaluateWorkflowRules(undefined, vars).blocked).toBe(false);
  });

  it('returns blocked:false when no rule matches', () => {
    expect(
      evaluateWorkflowRules(
        { rules: [{ if: '$CI_COMMIT_BRANCH == "feature"', when: 'never' }] },
        vars,
      ).blocked,
    ).toBe(false);
  });
});
