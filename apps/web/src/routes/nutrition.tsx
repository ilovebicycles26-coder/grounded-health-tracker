import type { EntityId } from '@grounded/domain';
import { mealTypes, type FoodEntry } from '@grounded/nutrition';
import { Button, Card, TextField } from '@grounded/ui/web';
import { useState, type FormEvent } from 'react';

import { FoodEntryDialog } from '../features/nutrition/FoodEntryDialog';
import { useNutritionTracker } from '../features/nutrition/useNutritionTracker';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function Component() {
  const [date, setDate] = useState(today);
  const tracker = useNutritionTracker(date);
  const [dialogEntry, setDialogEntry] = useState<FoodEntry | 'new' | null>(null);
  const summary = tracker.summary;

  async function saveTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await tracker.saveTarget({
      effectiveFrom: date,
      caloriesKcal: Number(data.get('targetCalories')),
      proteinGrams: data.get('targetProtein') ? Number(data.get('targetProtein')) : null,
    });
  }
  async function remove(id: EntityId) {
    if (window.confirm('Delete this food entry?')) await tracker.removeEntry(id);
  }

  return (
    <section className="page nutrition-page" aria-labelledby="nutrition-title">
      <header className="feature-heading">
        <div>
          <p className="eyebrow">FOOD DIARY</p>
          <h1 id="nutrition-title">Food is information, not a test.</h1>
          <p className="lede">
            Track what helps you. Estimates are useful; perfection is not required.
          </p>
        </div>
        <Button onClick={() => setDialogEntry('new')}>Add food</Button>
      </header>
      <div className="date-picker">
        <TextField
          label="Diary date"
          onChange={(event) => setDate(event.target.value)}
          type="date"
          value={date}
        />
      </div>
      {tracker.status === 'loading' ? (
        <Card aria-live="polite">Opening your diary…</Card>
      ) : tracker.status === 'error' ? (
        <Card>
          <h2>Your diary is unavailable</h2>
          <p>Your data has not been changed.</p>
          <Button onClick={() => void tracker.refresh()} variant="secondary">
            Try again
          </Button>
        </Card>
      ) : (
        <>
          <div className="metric-grid nutrition-metrics">
            <Card className="metric-card">
              <span>Calories logged</span>
              <strong>{summary.caloriesKcal.toLocaleString()}</strong>
              <small>
                {summary.remainingCalories === null
                  ? 'Set a target if it helps'
                  : `${summary.remainingCalories.toLocaleString()} kcal remaining`}
              </small>
            </Card>
            <Card className="metric-card">
              <span>Protein</span>
              <strong>{summary.proteinGrams === null ? '—' : `${summary.proteinGrams} g`}</strong>
              <small>Only counted when entered</small>
            </Card>
            <Card className="metric-card">
              <span>Meals</span>
              <strong>{summary.entries.length}</strong>
              <small>Entries on this day</small>
            </Card>
          </div>
          <div className="nutrition-layout">
            <Card className="diary-card">
              <div className="section-heading-row">
                <div>
                  <p className="eyebrow">DAY</p>
                  <h2>Your meals</h2>
                </div>
                <Button onClick={() => setDialogEntry('new')} variant="secondary">
                  Add food
                </Button>
              </div>
              {summary.entries.length === 0 ? (
                <p className="empty-state">
                  Nothing logged for this day. You can start with just one meal.
                </p>
              ) : (
                mealTypes.map((meal) => {
                  const entries = summary.entries.filter((entry) => entry.mealType === meal);
                  if (!entries.length) return null;
                  return (
                    <section className="meal-group" key={meal}>
                      <h3>
                        {meal[0]?.toUpperCase()}
                        {meal.slice(1)}
                      </h3>
                      {entries.map((entry) => (
                        <div className="diary-row" key={entry.id}>
                          <div>
                            <strong>{entry.name}</strong>
                            <small>
                              {entry.quantity} {entry.unit} · {entry.caloriesKcal} kcal
                            </small>
                          </div>
                          <div className="row-actions">
                            <Button onClick={() => setDialogEntry(entry)} variant="quiet">
                              Edit
                            </Button>
                            <Button onClick={() => void remove(entry.id)} variant="quiet">
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </section>
                  );
                })
              )}
            </Card>
            <div className="nutrition-side">
              <Card>
                <p className="eyebrow">DAILY GUIDE</p>
                <h2>{summary.target ? 'Adjust your target' : 'Optional target'}</h2>
                <p className="empty-state">
                  Targets are personal guides, not medical recommendations. Speak with a qualified
                  professional if you need clinical advice.
                </p>
                <form className="goal-form" onSubmit={(event) => void saveTarget(event)}>
                  <TextField
                    defaultValue={summary.target?.caloriesKcal ?? 2200}
                    label="Calories (kcal)"
                    min="1200"
                    name="targetCalories"
                    required
                    step="10"
                    type="number"
                  />
                  <TextField
                    defaultValue={summary.target?.proteinGrams ?? ''}
                    label="Protein (g, optional)"
                    min="0"
                    name="targetProtein"
                    step="1"
                    type="number"
                  />
                  <Button type="submit">Save target</Button>
                </form>
              </Card>
              <Card>
                <p className="eyebrow">FAVOURITES</p>
                <h2>Quick add</h2>
                {tracker.favourites.length === 0 ? (
                  <p className="empty-state">Tick “Save as a favourite” when adding food.</p>
                ) : (
                  <div className="favourite-list">
                    {tracker.favourites.map((item) => (
                      <button
                        key={item.id}
                        onClick={() =>
                          void tracker.saveEntry({
                            consumedOn: date,
                            mealType: 'snack',
                            name: item.name,
                            quantity: item.quantity,
                            unit: item.unit,
                            caloriesKcal: item.caloriesKcal,
                            proteinGrams: item.proteinGrams,
                            carbohydrateGrams: item.carbohydrateGrams,
                            fatGrams: item.fatGrams,
                          })
                        }
                        type="button"
                      >
                        <strong>{item.name}</strong>
                        <span>{item.caloriesKcal} kcal</span>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
      {dialogEntry ? (
        <FoodEntryDialog
          date={date}
          entry={dialogEntry === 'new' ? null : dialogEntry}
          onCancel={() => setDialogEntry(null)}
          onFavourite={async (input) => {
            await tracker.saveFavourite(input);
          }}
          onSave={async (input) => {
            const result = await tracker.saveEntry(input);
            if (result.ok) setDialogEntry(null);
            return result.ok;
          }}
        />
      ) : null}
    </section>
  );
}
