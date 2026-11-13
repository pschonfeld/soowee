import { describe, expect, it } from 'vitest';
import { DURATION_TOKENS, HANDS_OFF, parseTimer, plainText, renderInline, stepTimes } from './inline';

describe('parseTimer', () => {
  it('parses single and compound durations with generated labels', () => {
    expect(parseTimer('20m')).toEqual({ seconds: 1200, label: '20 minutes' });
    expect(parseTimer('1m')).toEqual({ seconds: 60, label: '1 minute' });
    expect(parseTimer('1h30m')).toEqual({ seconds: 5400, label: '1 hour 30 minutes' });
    expect(parseTimer('45s')).toEqual({ seconds: 45, label: '45 seconds' });
  });

  it('normalises equivalent spellings to the same label', () => {
    expect(parseTimer('90m').seconds).toBe(parseTimer('1h30m').seconds);
    expect(parseTimer('90m').label).toBe(parseTimer('1h30m').label);
  });

  it('rings a range at its lower bound', () => {
    expect(parseTimer('5-10m')).toEqual({ seconds: 300, label: '5–10 minutes' });
  });

  it('rejects malformed or empty timers', () => {
    expect(() => parseTimer('soon')).toThrow(/Invalid duration "{timer:/);
    expect(() => parseTimer('10')).toThrow(/Invalid duration "{timer:/);
    expect(() => parseTimer('0m')).toThrow(/no duration/);
    expect(() => parseTimer('10-5m')).toThrow(/Invalid duration "{timer:/);
  });
});

describe('renderInline', () => {
  it('escapes HTML before applying markup', () => {
    const html = renderInline('Use <script>alert(1)</script> & "quotes"');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;quotes&quot;');
  });

  it('renders bold, amounts and timers', () => {
    expect(renderInline('Add **butter**')).toBe('Add <strong>butter</strong>');
    expect(renderInline('{25 g}')).toBe('<span data-qty="25" data-unit="g">25</span> g');
    expect(renderInline('{2}')).toBe('<span data-qty="2">2</span>');
    const timer = renderInline('{timer:5-10m}');
    expect(timer).toContain('data-timer="300"');
    expect(timer).toContain('aria-label="Start timer: 5–10 minutes"');
  });

  it('fails loudly on an unknown unit', () => {
    expect(() => renderInline('{2 eggs}')).toThrow(/Unknown unit "eggs"/);
  });
});

describe('plainText', () => {
  it('strips markup for structured data', () => {
    expect(plainText('Add {25 g} **butter** and cook {timer:5-10m}.')).toBe(
      'Add 25 g butter and cook 5–10 minutes.',
    );
  });
});

describe('hands-off time', () => {
  it('renders every hands-off verb as a timer', () => {
    for (const token of Object.keys(HANDS_OFF)) {
      expect(renderInline(`{${token}:10m}`)).toContain('data-timer="600"');
    }
  });

  it('counts only hands-off verbs, not {timer:}, sums across steps, ignores tips and rounds to minutes', () => {
    const steps = [
      { text: ['Simmer {simmer:1h}, check {timer:5m}', { tip: 'A {bake:30m} in a tip is ignored' }] },
      { text: ['Bake {bake:20m}', 'Simmer {simmer:10s}'] },
    ];
    expect(stepTimes(steps)).toEqual({ handsOff: 80, activities: ['simmer', 'bake'], after: [] });
  });

  it('lists each activity once, in order of first appearance', () => {
    const steps = [{ text: ['{rest:5m}', '{bake:5m}', '{rest:5m}'] }];
    expect(stepTimes(steps).activities).toEqual(['rest', 'bake']);
  });
});

describe('time after the dish is finished', () => {
  it('renders as plain text, not a timer button', () => {
    expect(renderInline('Refrigerate for at least {chill:8h}.')).toBe('Refrigerate for at least 8 hours.');
    expect(renderInline('Freeze for {freeze:6h}.')).toBe('Freeze for 6 hours.');
    expect(plainText('Chill {chill:6-8h}.')).toBe('Chill 6–8 hours.');
  });

  it('is counted on its own, never as hands-off time, per kind', () => {
    const steps = [
      { text: ['Simmer {simmer:1h}', 'Chill {chill:8h}', 'Chill {chill:30m} more', { tip: 'A {chill:2h} in a tip is ignored' }] },
    ];
    expect(stepTimes(steps)).toEqual({ handsOff: 60, activities: ['simmer'], after: [{ token: 'chill', minutes: 510 }] });
  });

  it('names the token when the duration is invalid', () => {
    expect(() => renderInline('Chill {chill:overnight}')).toThrow(/Invalid duration "\{chill:overnight\}"/);
    expect(() => renderInline('Bake {bake:soon}')).toThrow(/Invalid duration "\{bake:soon\}"/);
  });
});

describe('unknown tokens', () => {
  it('fail instead of being printed raw', () => {
    expect(() => renderInline('Simmer {wait:1h}')).toThrow(/Unknown token "\{wait:1h\}"/);
    expect(() => plainText('{steam:5m}')).toThrow(/Unknown token/);
    for (const typo of ['{Bake:5m}', '{bake2:5m}', '{pre-heat:5m}', '{ bake :5m}', '{bake :5m}']) {
      expect(() => renderInline(typo), typo).toThrow(/Unknown token/);
    }
    expect(DURATION_TOKENS).toContain('timer');
  });

  it('a known token without a duration fails too', () => {
    for (const empty of ['{bake:}', '{timer:}', '{chill:}']) {
      expect(() => renderInline(empty), empty).toThrow(/Invalid duration/);
    }
  });

  it('leaves amounts and ordinary braces alone', () => {
    expect(plainText('{25 g} and {2}')).toBe('25 g and 2');
  });
});
