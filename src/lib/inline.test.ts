import { describe, expect, it } from 'vitest';
import {
  DURATION_TOKENS,
  HANDS_OFF,
  WAITS,
  keepAmountsWhole,
  parseQuantity,
  parseTimer as parseTimerIn,
  plainText as plainTextIn,
  renderInline as renderInlineIn,
  directionTimes,
} from './inline';

// Most cases are about the markup, not the language: they run in English. Czech has its own block at the end.
const parseTimer = (value: string, token = 'timer') => parseTimerIn(value, token, 'en');
const plainText = (source: string) => plainTextIn(source, 'en');
const renderInline = (source: string) => renderInlineIn(source, { locale: 'en' });

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
    expect(renderInline('{25 g}')).toBe('<span data-qty="25" data-unit="g">25</span>\u00a0g');
    expect(renderInline('{2}')).toBe('<span data-qty="2">2</span>');
    const timer = renderInline('{timer:5-10m}');
    expect(timer).toContain('class="duration"');
    expect(timer).toContain('5–10 minutes');
  });

  it('renders ingredient mentions with and without an amount', () => {
    expect(renderInline('{750 g mascarpone}')).toBe('<strong><span data-qty="750" data-unit="g">750</span>\u00a0g mascarpone</strong>');
    expect(renderInline('{6 eggs}')).toBe('<strong><span data-qty="6">6</span> eggs</strong>');
    expect(renderInline('{cocoa powder}')).toBe('<strong>cocoa powder</strong>');
  });

  it('keeps punctuation after a timer on the same line as the timer', () => {
    const html = renderInline('Fry for {timer:5m}, then drain.');
    expect(html).toMatch(/^Fry for <span class="duration-wrap"><span class="duration">[^]*<\/span>,<\/span> then drain\.$/);
    expect(renderInline('Fry for {timer:5m} more.')).not.toContain('duration-wrap');
    // Two timers, punctuation after the second only: each timer is wrapped on its own, never the text between them.
    const two = renderInline('Fry {timer:5m} then rest {timer:3m}.');
    expect(two.match(/duration-wrap/g)).toHaveLength(1);
    expect(two).toMatch(/then rest <span class="duration-wrap"><span class="duration">/);
  });

  it('fails loudly on a unit stuck to the number that is not a unit', () => {
    expect(() => renderInline('{25gr}')).toThrow(/Unknown unit "gr"/);
  });

  it('fails loudly on a malformed token', () => {
    expect(() => renderInline('{ }')).toThrow(/Malformed token/);
    expect(() => renderInline('{-2 g}')).toThrow(/Malformed token/);
    expect(() => renderInline('{0 g}')).toThrow(/above zero/);
    expect(() => renderInline('{25 g: butter}')).toThrow(/Unknown token/);
    expect(() => plainText('at {5:00}')).toThrow(/Unknown token/);
  });
});

describe('plainText', () => {
  it('strips markup for structured data', () => {
    expect(plainText('Add {25 g} **butter** and cook {timer:5-10m}.')).toBe(
      'Add 25\u00a0g butter and cook 5–10 minutes.',
    );
  });
});

describe('hands-off time', () => {
  it('renders every hands-off verb as a highlighted duration', () => {
    for (const token of Object.keys(HANDS_OFF)) {
      expect(renderInline(`{${token}:10m}`)).toContain('class="duration"');
    }
  });

  it('counts only hands-off verbs, not {timer:}, sums across sections, ignores tips and rounds to minutes', () => {
    const directions = [
      { steps: ['Simmer {simmer:1h}, check {timer:5m}', { tip: 'A {bake:30m} in a tip is ignored' }] },
      { steps: ['Bake {bake:20m}', 'Simmer {simmer:10s}'] },
    ];
    expect(directionTimes(directions)).toEqual({ handsOff: 80, activities: ['simmer', 'bake'], waits: [] });
  });

  it('lists each activity once, in order of first appearance', () => {
    const directions = [{ steps: ['{cool:5m}', '{bake:5m}', '{cool:5m}'] }];
    expect(directionTimes(directions).activities).toEqual(['cool', 'bake']);
  });
});

describe('waits', () => {
  it('are highlighted outside the fridge and freezer', () => {
    for (const token of ['rest', 'rise', 'marinate']) {
      expect(renderInline(`{${token}:10m}`)).toContain('class="duration"');
    }
  });

  it('are counted on their own, never as hands-off time: others in order of first use, then fridge, then freezer', () => {
    const directions = [{ steps: ['Freeze {freeze:2h}', 'Chill {chill:1h}', 'Rise {rise:1h}', 'Rest {rest:30m}', 'Rise {rise:30m}', 'Bake {bake:20m}'] }];
    expect(directionTimes(directions)).toEqual({
      handsOff: 20,
      activities: ['bake'],
      waits: [
        { token: 'rise', minutes: 90 },
        { token: 'rest', minutes: 30 },
        { token: 'chill', minutes: 60 },
        { token: 'freeze', minutes: 120 },
      ],
    });
  });

  it('no verb is both hands-off and a wait', () => {
    expect(Object.keys(HANDS_OFF).filter((token) => token in WAITS)).toEqual([]);
  });
});

describe('keepAmountsWhole', () => {
  it('joins a number to its unit and the ends of a range, in text only', () => {
    expect(keepAmountsWhole('Heat to 190 °C, then 2-3 minutes and 60–63 °C.')).toBe(
      'Heat to 190\u00a0°C, then 2\u2060-\u20603\u00a0minutes and 60\u2060–\u206063\u00a0°C.',
    );
    // Duration labels stay as generated; surrounding amounts still get nonbreaking spaces.
    expect(keepAmountsWhole('<span class="duration"><span>12\u201315 minutes</span></span>, then 2 g')).toBe(
      '<span class="duration"><span>12\u201315 minutes</span></span>, then 2\u00a0g',
    );
    expect(renderInline('Simmer for {simmer:12-15m}, stirring.')).toContain('<span>12\u201315 minutes</span>');
  });

  it('leaves words that only start like a unit alone', () => {
    expect(keepAmountsWhole('2 garlic cloves, 3 large eggs, 4 layers')).toBe('2 garlic cloves, 3 large eggs, 4 layers');
  });

  it('runs on every rendered step', () => {
    expect(renderInline('Bring the oil to **190 °C**.')).toBe('Bring the oil to <strong>190\u00a0°C</strong>.');
  });
});

describe('time in the fridge or freezer', () => {
  it('renders as plain text, not a timer button', () => {
    expect(renderInline('Refrigerate for at least {chill:8h}.')).toBe('Refrigerate for at least 8\u00a0hours.');
    expect(renderInline('Freeze for {freeze:6h}.')).toBe('Freeze for 6\u00a0hours.');
    expect(plainText('Chill {chill:6-8h}.')).toBe('Chill 6–8 hours.');
  });

  it('is counted on its own, never as hands-off time, per kind', () => {
    const directions = [
      { steps: ['Simmer {simmer:1h}', 'Chill {chill:8h}', 'Chill {chill:30m} more', { tip: 'A {chill:2h} in a tip is ignored' }] },
    ];
    expect(directionTimes(directions)).toEqual({ handsOff: 60, activities: ['simmer'], waits: [{ token: 'chill', minutes: 510 }] });
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
    expect(plainText('{25 g} and {2}')).toBe('25\u00a0g and 2');
  });
});

describe('Czech', () => {
  const cs = (source: string) => renderInlineIn(source, { locale: 'cs' });

  it('words durations with the Czech plural, a range agreeing with its upper bound', () => {
    expect(parseTimerIn('1m', 'timer', 'cs').label).toBe('1 minutu'); // accusative: "šlehejte 1 minutu"
    expect(parseTimerIn('3m', 'timer', 'cs').label).toBe('3 minuty');
    expect(parseTimerIn('20m', 'timer', 'cs').label).toBe('20 minut');
    expect(parseTimerIn('1h30m', 'timer', 'cs').label).toBe('1 hodinu 30 minut');
    expect(parseTimerIn('5-10m', 'timer', 'cs').label).toBe('5–10 minut');
    expect(parseTimerIn('1-2m', 'timer', 'cs').label).toBe('1–2 minuty');
    expect(cs('{timer:5m}')).toContain('5 minut');
  });

  it('spells the spoons out and lets them follow the scale', () => {
    expect(cs('{2 tbsp}')).toBe(
      '<span data-qty="2" data-unit="tbsp">2</span>\u00a0<span data-forms="{&quot;one&quot;:&quot;lžíci&quot;,&quot;few&quot;:&quot;lžíce&quot;,&quot;many&quot;:&quot;lžíce&quot;,&quot;other&quot;:&quot;lžic&quot;}" data-count="2">lžíce</span>',
    );
    expect(plainTextIn('{5 tbsp} a {0.5 tsp}', 'cs')).toBe('5\u00a0lžic a ½\u00a0lžičky');
    expect(plainTextIn('{1.5 L}', 'cs')).toBe('1,5\u00a0l');
  });

  it('keeps the written form of a counted ingredient at its own number and uses its forms at the others', () => {
    const forms = { one: 'cibule', few: 'cibule', many: 'cibule', other: 'cibulí' };
    const html = renderInlineIn('Nakrájejte {1 cibuli}.', { locale: 'cs', forms: () => forms });
    expect(html).toContain('>cibuli</span></strong>');
    expect(html).toContain('&quot;one&quot;:&quot;cibuli&quot;');
    expect(html).toContain('&quot;other&quot;:&quot;cibulí&quot;');
  });

  it('shows the left side of {shown|name}', () => {
    expect(cs('Vymažte {máslem|máslo}.')).toBe('Vymažte <strong>máslem</strong>.');
    expect(parseQuantity('35 g másla|máslo')).toEqual({ qty: 35, unit: 'g', name: 'máslo', text: 'másla' });
    expect(() => parseQuantity('a|b|c')).toThrow(/Malformed mention/);
    expect(() => parseQuantity('máslem|')).toThrow(/Malformed mention/);
  });
});
