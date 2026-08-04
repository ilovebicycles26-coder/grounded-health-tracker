import type { IdGenerator } from '@grounded/application';
import { asIsoDate, type EntityId, type UserId } from '@grounded/domain';

import type { WeightEntry, WeightKilograms } from './index';

export interface PrototypeWeightImportIssue {
  readonly index: number;
  readonly code:
    'invalid_shape' | 'invalid_date' | 'invalid_weight' | 'note_too_long' | 'duplicate';
}

export interface PrototypeWeightImportPlan {
  readonly entries: readonly WeightEntry[];
  readonly issues: readonly PrototypeWeightImportIssue[];
  readonly sourceCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function planPrototypeWeightImport(
  source: readonly unknown[],
  ownerId: UserId,
  ids: IdGenerator,
): PrototypeWeightImportPlan {
  const entries: WeightEntry[] = [];
  const issues: PrototypeWeightImportIssue[] = [];
  const fingerprints = new Set<string>();

  source.forEach((value, index) => {
    if (!isRecord(value)) {
      issues.push({ index, code: 'invalid_shape' });
      return;
    }
    const dateValue = value.date;
    const weightValue = value.weight;
    const noteValue = value.note;
    if (typeof dateValue !== 'string') {
      issues.push({ index, code: 'invalid_date' });
      return;
    }
    const date = asIsoDate(dateValue);
    if (!date.ok) {
      issues.push({ index, code: 'invalid_date' });
      return;
    }
    if (typeof weightValue !== 'number') {
      issues.push({ index, code: 'invalid_weight' });
      return;
    }
    if (!Number.isFinite(weightValue) || weightValue < 25 || weightValue > 500) {
      issues.push({ index, code: 'invalid_weight' });
      return;
    }
    const weight = (Math.round(weightValue * 1_000) / 1_000) as WeightKilograms;
    const note = typeof noteValue === 'string' && noteValue.trim() ? noteValue.trim() : null;
    if (note && note.length > 240) {
      issues.push({ index, code: 'note_too_long' });
      return;
    }
    const fingerprint = `${date.value}|${weight}|${note ?? ''}`;
    if (fingerprints.has(fingerprint)) {
      issues.push({ index, code: 'duplicate' });
      return;
    }
    fingerprints.add(fingerprint);
    const sourceId = typeof value.id === 'string' && isUuid(value.id) ? value.id : ids.create();
    entries.push({
      id: sourceId as EntityId,
      ownerId,
      measuredOn: date.value,
      kilograms: weight,
      note,
      recordedAt: `${date.value}T12:00:00.000Z`,
    });
  });

  return { entries, issues, sourceCount: source.length };
}
