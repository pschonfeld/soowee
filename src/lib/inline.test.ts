import { describe, expect, it } from 'vitest';
import { parseTimer, plainText, renderInline, totalChillMinutes, totalWaitMinutes, waitSeconds } from './inline';

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

describe('wait time', () => {
  it('counts only {wait:} timers, not {timer:}', () => {
    expect(waitSeconds('Simmer {wait:1h} then check {timer:5m}')).toBe(3600);
    expect(waitSeconds('Nothing to wait for')).toBe(0);
  });

  it('sums across steps, ignores tips, and rounds to minutes', () => {
    const steps = [
      { text: ['Simmer {wait:1h}', { tip: 'A {wait:30m} in a tip is ignored' }] },
      { text: ['Bake {wait:20m}'] },
    ];
    expect(totalWaitMinutes(steps)).toBe(80);
  });
});

describe('chill time', () => {
  it('renders as plain text, not a timer button', () => {
    const html = renderInline('Refrigerate for at least {chill:8h}.');
    expect(html).toBe('Refrigerate for at least 8 hours.');
    expect(plainText('Chill {chill:6-8h}.')).toBe('Chill 6–8 hours.');
  });

  it('is counted on its own, never as hands-off time', () => {
    const steps = [
      { text: ['Simmer {wait:1h}', 'Chill {chill:8h}', { tip: 'A {chill:2h} in a tip is ignored' }] },
    ];
    expect(totalChillMinutes(steps)).toBe(480);
    expect(totalWaitMinutes(steps)).toBe(60);
  });

  it('names the {chill:} token when the duration is invalid', () => {
    expect(() => renderInline('Chill {chill:overnight}')).toThrow(/Invalid duration "\{chill:overnight\}"/);
  });
});
