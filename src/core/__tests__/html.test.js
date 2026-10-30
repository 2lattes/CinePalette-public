import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../html.js';
import { FILMS as FR } from '../../data/films.fr.js';
import { FILMS as EN } from '../../data/films.en.js';

describe('escapeHtml', () => {
  it('neutralise les caractères HTML', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(escapeHtml('Deadpool & Wolverine')).toBe('Deadpool &amp; Wolverine');
    expect(escapeHtml(`"l'été"`)).toBe('&quot;l&#39;été&quot;');
  });

  it('accepte les valeurs absentes ou numériques', () => {
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(1957)).toBe('1957');
  });
});

describe('datasets', () => {
  it('aucun titre ne contient de balise', () => {
    for (const f of [...FR, ...EN]) {
      expect(`${f.t ?? ''}${f.o ?? ''}`).not.toMatch(/[<>]/);
    }
  });
});
