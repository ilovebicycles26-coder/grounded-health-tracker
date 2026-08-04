import { Button } from '@grounded/ui/web';
import { useEffect, useRef, useState } from 'react';
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  ('standalone' in navigator &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true);
export function InstallAppButton() {
  const prompt = useRef<InstallPrompt | null>(null);
  const [available, setAvailable] = useState(() => !standalone());
  const [instructions, setInstructions] = useState(false);
  useEffect(() => {
    if (standalone()) return;
    const capture = (event: Event) => {
      event.preventDefault();
      prompt.current = event as InstallPrompt;
    };
    window.addEventListener('beforeinstallprompt', capture);
    return () => window.removeEventListener('beforeinstallprompt', capture);
  }, []);
  if (!available) return null;
  async function install() {
    if (prompt.current) {
      await prompt.current.prompt();
      const choice = await prompt.current.userChoice;
      if (choice.outcome === 'accepted') setAvailable(false);
      prompt.current = null;
    } else setInstructions(true);
  }
  return (
    <>
      <button className="header-button" onClick={() => void install()} type="button">
        Install app
      </button>
      {instructions ? (
        <dialog className="install-dialog" open>
          <div>
            <p className="eyebrow">INSTALL GROUNDED</p>
            <h2>Add it to your phone</h2>
            <ol>
              <li>On iPhone, open this page in Safari and tap the Share button.</li>
              <li>
                Choose <strong>Add to Home Screen</strong>, then tap Add.
              </li>
              <li>
                On Android, open the browser menu and choose <strong>Install app</strong> or{' '}
                <strong>Add to Home screen</strong>.
              </li>
            </ol>
            <Button onClick={() => setInstructions(false)}>Done</Button>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
