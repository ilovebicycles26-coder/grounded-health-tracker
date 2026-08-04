# Accessibility standard

Grounded targets WCAG 2.2 AA for web and equivalent native platform accessibility expectations.

## Required behaviour

- Complete keyboard access with logical focus order and visible focus.
- Screen-reader names, roles, states, errors, and live-region announcements.
- Text reflows at 200% zoom without loss of content or action.
- Mobile layouts support platform text scaling and do not lock font size.
- Minimum 44 by 44 CSS-point touch targets where practical.
- Colour is never the only carrier of meaning.
- AA contrast for text and meaningful controls in every theme.
- Reduced-motion preference disables non-essential animation.
- Charts have a written summary and data-table alternative.
- Forms preserve entered data after validation errors and move focus appropriately.
- Dialogs trap focus, close predictably, and restore focus to their opener.
- Dates, units, and numbers are localised and understandable.
- Health language is plain, respectful, and non-judgemental.

## Engineering gates

- Shared primitives include automated accessibility tests.
- Storybook covers keyboard, screen reader labels, themes, zoom, and long text.
- Playwright runs axe checks on critical web routes.
- Manual VoiceOver, TalkBack, keyboard-only, zoom, contrast, and reduced-motion testing occurs before release.
- Accessibility regressions block release at the same severity as functional regressions.

## Known high-risk areas

- Interactive charts and data tooltips.
- Reorderable routine steps.
- Date and unit entry.
- Toasts and background sync announcements.
- Dense food and weight histories.
- Sharing permission explanations.
