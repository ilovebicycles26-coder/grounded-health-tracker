export interface AchievementContext {
  readonly weightEntries: number;
  readonly foodDays: number;
  readonly workoutSessions: number;
  readonly habitCompletions: number;
  readonly longestHabitStreak: number;
}
export interface AchievementDefinition {
  readonly code: string;
  readonly version: number;
  readonly title: string;
  readonly description: string;
  readonly earned: (context: AchievementContext) => boolean;
  readonly evidence: (context: AchievementContext) => Readonly<Record<string, number>>;
}
export const achievementDefinitions: readonly AchievementDefinition[] = [
  {
    code: 'first_check_in',
    version: 1,
    title: 'First check-in',
    description: 'You logged your first weight.',
    earned: (c) => c.weightEntries >= 1,
    evidence: (c) => ({ entries: c.weightEntries }),
  },
  {
    code: 'seeing_the_trend',
    version: 1,
    title: 'Seeing the trend',
    description: 'Five weight entries create a more useful picture.',
    earned: (c) => c.weightEntries >= 5,
    evidence: (c) => ({ entries: c.weightEntries }),
  },
  {
    code: 'fuel_awareness',
    version: 1,
    title: 'Fuel awareness',
    description: 'You used the food diary on three different days.',
    earned: (c) => c.foodDays >= 3,
    evidence: (c) => ({ days: c.foodDays }),
  },
  {
    code: 'moved_your_way',
    version: 1,
    title: 'Moved your way',
    description: 'You completed a movement session you chose.',
    earned: (c) => c.workoutSessions >= 1,
    evidence: (c) => ({ sessions: c.workoutSessions }),
  },
  {
    code: 'movement_rhythm',
    version: 1,
    title: 'Movement rhythm',
    description: 'Five completed sessions, one at a time.',
    earned: (c) => c.workoutSessions >= 5,
    evidence: (c) => ({ sessions: c.workoutSessions }),
  },
  {
    code: 'small_actions',
    version: 1,
    title: 'Small actions',
    description: 'Seven habit completions, without demanding perfection.',
    earned: (c) => c.habitCompletions >= 7,
    evidence: (c) => ({ completions: c.habitCompletions }),
  },
  {
    code: 'scheduled_streak',
    version: 1,
    title: 'Your kind of consistency',
    description: 'Five scheduled habit days completed.',
    earned: (c) => c.longestHabitStreak >= 5,
    evidence: (c) => ({ streak: c.longestHabitStreak }),
  },
];
export function evaluateAchievements(context: AchievementContext) {
  return achievementDefinitions.map((definition) => ({
    definition,
    earned: definition.earned(context),
    evidence: definition.earned(context) ? definition.evidence(context) : null,
  }));
}
