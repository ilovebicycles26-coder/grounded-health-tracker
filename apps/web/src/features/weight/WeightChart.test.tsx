// @vitest-environment jsdom

import { asIsoDate } from '@grounded/domain';
import { asWeightKilograms } from '@grounded/weight';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WeightChart } from './WeightChart';

describe('WeightChart', () => {
  it('provides a text summary and table alternative to the visual chart', () => {
    const date = asIsoDate('2026-08-04');
    const weight = asWeightKilograms(105);
    if (!date.ok || !weight.ok) throw new Error('Fixture setup failed');
    render(
      <WeightChart
        points={[
          { date: date.value, kilograms: weight.value, rollingAverageKilograms: weight.value },
        ]}
        unitSystem="metric"
      />,
    );
    expect(screen.getByText(/105.0 kg on 2026-08-04/)).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getAllByText('105.0 kg')).toHaveLength(2);
  });
});
