import { formatWeight, type WeightTrendPoint } from '@grounded/weight';

interface WeightChartProps {
  readonly points: readonly WeightTrendPoint[];
  readonly unitSystem: 'metric' | 'imperial';
}

function coordinate(value: number, minimum: number, maximum: number, height: number): number {
  if (minimum === maximum) return height / 2;
  return height - ((value - minimum) / (maximum - minimum)) * height;
}

export function WeightChart({ points, unitSystem }: WeightChartProps) {
  if (points.length === 0) {
    return <p className="empty-state">Your trend will appear after your first weight entry.</p>;
  }
  const width = 640;
  const height = 220;
  const padding = 18;
  const values = points.flatMap((point) => [point.kilograms, point.rollingAverageKilograms]);
  const minimum = Math.min(...values) - 1;
  const maximum = Math.max(...values) + 1;
  const x = (index: number) =>
    points.length === 1
      ? width / 2
      : padding + (index / (points.length - 1)) * (width - padding * 2);
  const y = (value: number) => coordinate(value, minimum, maximum, height - padding * 2) + padding;
  const actual = points.map((point, index) => `${x(index)},${y(point.kilograms)}`).join(' ');
  const rolling = points
    .map((point, index) => `${x(index)},${y(point.rollingAverageKilograms)}`)
    .join(' ');
  const first = points[0];
  const last = points.at(-1);

  return (
    <figure className="weight-chart" aria-labelledby="weight-chart-title weight-chart-summary">
      <figcaption>
        <h2 id="weight-chart-title">Weight trend</h2>
        <p id="weight-chart-summary">
          {first && last
            ? `${formatWeight(first.kilograms, unitSystem)} on ${first.date}; ${formatWeight(last.kilograms, unitSystem)} on ${last.date}. The smoother line is your seven-entry average.`
            : 'Your recorded weight trend.'}
        </p>
      </figcaption>
      <svg aria-hidden="true" className="weight-chart__plot" viewBox={`0 0 ${width} ${height}`}>
        <line
          className="weight-chart__grid"
          x1={padding}
          x2={width - padding}
          y1={padding}
          y2={padding}
        />
        <line
          className="weight-chart__grid"
          x1={padding}
          x2={width - padding}
          y1={height - padding}
          y2={height - padding}
        />
        <polyline className="weight-chart__actual" points={actual} />
        <polyline className="weight-chart__average" points={rolling} />
        {points.map((point, index) => (
          <circle
            className="weight-chart__point"
            cx={x(index)}
            cy={y(point.kilograms)}
            key={`${point.date}-${index}`}
            r="5"
          />
        ))}
      </svg>
      <details className="chart-data">
        <summary>View trend as a table</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Weight</th>
                <th scope="col">7-entry average</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point, index) => (
                <tr key={`${point.date}-row-${index}`}>
                  <th scope="row">{point.date}</th>
                  <td>{formatWeight(point.kilograms, unitSystem)}</td>
                  <td>{formatWeight(point.rollingAverageKilograms, unitSystem)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
