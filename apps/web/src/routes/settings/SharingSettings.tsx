import type { ShareableResource } from '@grounded/sharing';
import { Button, Card, Checkbox, TextField } from '@grounded/ui/web';
import { useState, type FormEvent } from 'react';
import { useSharing } from '../../features/sharing/useSharing';
import { formText } from '../../shared/formData';
const labels: Record<ShareableResource, { title: string; description: string }> = {
  weight_progress: {
    title: 'Weight progress',
    description: 'Current, starting and goal values only. Notes and raw history stay private.',
  },
  routine_library: {
    title: 'Exercise routines',
    description: 'Routine names, instructions and steps. Workout notes stay private.',
  },
  habit_progress: {
    title: 'Habit progress',
    description: 'Habit names and completion dates. Wellbeing check-ins and notes stay private.',
  },
};
export function Component() {
  const sharing = useSharing();
  const [invite, setInvite] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function create() {
    const result = await sharing.createInvite();
    if (result?.ok) {
      setInvite(result.value);
      setMessage('Invite ready. It expires in seven days.');
    } else setMessage('Could not create an invite. Check your connection.');
  }
  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = formText(new FormData(event.currentTarget), 'code');
    setMessage(
      (await sharing.acceptInvite(code))
        ? 'Partner connected. Nothing is shared until you enable a category.'
        : 'That code is invalid, expired or belongs to this account.',
    );
  }
  return (
    <Card>
      <header className="settings-section-heading">
        <p className="eyebrow">SHARING</p>
        <h2>Zoe and partner access</h2>
        <p>A partnership is not permission. You choose each category, and can turn it off again.</p>
      </header>
      {sharing.status === 'loading' ? (
        <p aria-live="polite">Loading partner settings…</p>
      ) : sharing.status === 'error' ? (
        <div className="form-error" role="alert">
          Sharing needs an internet connection and a configured account.{' '}
          <Button onClick={() => void sharing.refresh()} variant="quiet">
            Try again
          </Button>
        </div>
      ) : (
        <div className="sharing-sections">
          <section>
            <h3>Invite Zoe</h3>
            <p>
              Create a one-time code, then send it to Zoe privately. She signs in to her own account
              and enters it below.
            </p>
            {invite ? (
              <div className="invite-code">
                <code>{invite}</code>
                <Button
                  onClick={() => void navigator.clipboard.writeText(invite)}
                  variant="secondary"
                >
                  Copy code
                </Button>
              </div>
            ) : (
              <Button onClick={() => void create()}>Create invite code</Button>
            )}
          </section>
          <section>
            <h3>Enter an invite code</h3>
            <form className="accept-invite" onSubmit={(event) => void accept(event)}>
              <TextField
                autoComplete="off"
                label="10-character code"
                maxLength={10}
                name="code"
                required
              />
              <Button type="submit">Connect accounts</Button>
            </form>
          </section>
          {message ? (
            <p
              className={
                message.startsWith('Could') || message.startsWith('That')
                  ? 'form-error'
                  : 'success-message'
              }
              role="status"
            >
              {message}
            </p>
          ) : null}
          <section>
            <h3>Connected partners</h3>
            {sharing.partners.length === 0 ? (
              <p>No partner connected yet.</p>
            ) : (
              sharing.partners.map((partner) => {
                const summary = sharing.summaries[partner.userId];
                return (
                  <div className="partner-card" key={partner.partnershipId}>
                    <div>
                      <h4>{partner.displayName}</h4>
                      {summary ? (
                        <p>
                          {summary.currentKilograms.toFixed(1)} kg current ·{' '}
                          {summary.lastMeasuredOn}
                        </p>
                      ) : (
                        <p>No weight progress has been shared with you.</p>
                      )}
                    </div>
                    <fieldset>
                      <legend>Share with {partner.displayName}</legend>
                      {sharing.resources.map((resource) => {
                        const active = sharing.grants.some(
                          (grant) =>
                            grant.recipientId === partner.userId &&
                            grant.resource === resource &&
                            grant.active,
                        );
                        return (
                          <Checkbox
                            checked={active}
                            hint={labels[resource].description}
                            key={resource}
                            label={labels[resource].title}
                            onChange={(event) =>
                              void sharing.setGrant(partner.userId, resource, event.target.checked)
                            }
                          />
                        );
                      })}
                    </fieldset>
                  </div>
                );
              })
            )}
          </section>
        </div>
      )}
    </Card>
  );
}
