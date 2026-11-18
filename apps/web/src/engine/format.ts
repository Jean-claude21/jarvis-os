import { stateOf } from '../lib/words';
import type { Field } from './types';

// A value as she reads it: a day, an amount, a choice in her words, a link's title.

const isDay = (text: string) => /^\d{4}-\d{2}-\d{2}$/.test(text);
const isInstant = (text: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text);

export function dayText(value: string) {
  return new Date(isDay(value) ? `${value}T12:00:00` : value).toLocaleDateString('fr', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function showValue(value: unknown, field?: Field): string {
  if (value === null || value === undefined || value === '') return '';
  if (Array.isArray(value))
    return value
      .map((one) => showValue(one, field))
      .filter(Boolean)
      .join(', ');
  if (typeof value === 'object') {
    const one = value as Record<string, unknown>;
    if (typeof one.title === 'string') return one.title;
    return JSON.stringify(value).slice(0, 60);
  }
  if (typeof value === 'boolean') return value ? 'oui' : 'non';
  if (typeof value === 'number') {
    if (field?.type === 'amount')
      return value.toLocaleString('fr', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return value.toLocaleString('fr');
  }
  const text = String(value);
  if (field?.optionLabels?.[text]) return field.optionLabels[text]!;
  if (field?.type === 'choice') return stateOf(text);
  if (isDay(text)) return dayText(text);
  if (isInstant(text))
    return new Date(text).toLocaleString('fr', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  return text;
}

/** A value to sort by: numbers as numbers, days and text as text. */
export function sortValue(value: unknown): string | number {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') return value;
  if (typeof value === 'object') {
    const one = value as Record<string, unknown>;
    return typeof one.title === 'string' ? one.title.toLowerCase() : '';
  }
  return String(value).toLowerCase();
}

/** A value to filter and group by: a choice's code, a link's title, the text itself. */
export function keyValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (Array.isArray(value)) return value.map(keyValue).join(', ');
  if (typeof value === 'object') {
    const one = value as Record<string, unknown>;
    return typeof one.title === 'string' ? one.title : '';
  }
  return String(value);
}

/** The common types' fields (v3 D8), in her words, when no model names them. */
const COMMON_WORDS: Record<string, string> = {
  email: 'E-mail',
  phone: 'Téléphone',
  circle: 'Cercle',
  relation: 'Relation',
  birthday: 'Anniversaire',
  last_contact: 'Dernier contact',
  website: 'Site',
  type: 'Genre',
  address: 'Adresse',
  city: 'Ville',
  country: 'Pays',
  amount: 'Montant',
  date: 'Date',
  due: 'Échéance',
  status: 'Statut',
  priority: 'Priorité',
  start: 'Début',
  end: 'Fin',
  place: 'Lieu',
  with: 'Avec',
  note: 'Note',
  tags: 'Étiquettes',
  organization: 'Organisation',
  pris_le: 'Prise le',
  lieu: 'Lieu',
  largeur: 'Largeur',
  hauteur: 'Hauteur',
  source: 'Source',
};
export const fieldWord = (path: string) => COMMON_WORDS[path] ?? path.replace(/_/g, ' ');
