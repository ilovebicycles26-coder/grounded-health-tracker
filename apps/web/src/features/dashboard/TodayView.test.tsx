// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { asWeightKilograms, calculateWeightSummary } from '@grounded/weight';
import type { EntityId, IsoDate, UserId } from '@grounded/domain';

import { TodayView } from './TodayView';

const empty = calculateWeightSummary([], null);

describe('TodayView', () => {
  it('personalises the heading and provides useful empty-state actions', () => {
    render(
      <MemoryRouter>
        <TodayView
          displayName="Richard Example"
          isOnline
          onRetry={vi.fn()}
          unitSystem="metric"
          weight={empty}
          weightStatus="ready"
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Hello, Richard.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log first weight' })).toHaveAttribute(
      'href',
      '/progress/weight',
    );
  });

  it('shows offline reassurance and weight progress', () => {
    const kilograms = asWeightKilograms(100);
    const goal = asWeightKilograms(90);
    if (!kilograms.ok || !goal.ok) throw new Error('Invalid fixture');
    const summary = calculateWeightSummary(
      [
        {
          id: 'entry' as EntityId,
          ownerId: 'owner' as UserId,
          measuredOn: '2026-08-04' as IsoDate,
          kilograms: kilograms.value,
          note: null,
          recordedAt: '2026-08-04T08:00:00.000Z',
        },
      ],
      {
        id: 'goal' as EntityId,
        ownerId: 'owner' as UserId,
        targetKilograms: goal.value,
        targetDate: null,
        createdAt: '2026-08-04T08:00:00.000Z',
      },
    );
    render(
      <MemoryRouter>
        <TodayView
          displayName=""
          isOnline={false}
          onRetry={vi.fn()}
          unitSystem="metric"
          weight={summary}
          weightStatus="ready"
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('You are offline');
    expect(screen.getByText('100.0 kg')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });
});
