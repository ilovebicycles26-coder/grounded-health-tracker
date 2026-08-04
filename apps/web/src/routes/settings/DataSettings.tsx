import type { Clock, IdGenerator } from '@grounded/application';
import {
  createBackup,
  previewBackup,
  type BackupPreview,
  type BackupRecord,
} from '@grounded/backup';
import type { UserId } from '@grounded/domain';
import { exerciseEntityTypes } from '@grounded/exercise';
import { habitEntityTypes } from '@grounded/habits';
import { LocalEntityRepository } from '@grounded/local-store';
import { nutritionEntityTypes } from '@grounded/nutrition';
import { Button, Card } from '@grounded/ui/web';
import { weightEntityTypes } from '@grounded/weight';
import { useState, type ChangeEvent } from 'react';
import { useAuth } from '../../features/auth/AuthProvider';
import { localStoreManager } from '../../platform/local/runtime';
const entityTypes = [
  ...Object.values(weightEntityTypes),
  ...Object.values(nutritionEntityTypes),
  ...Object.values(exerciseEntityTypes),
  ...Object.values(habitEntityTypes),
];
const clock: Clock = { now: () => new Date() };
const ids: IdGenerator = { create: () => crypto.randomUUID() };
export function Component() {
  const auth = useAuth();
  const ownerId = auth.session?.user.id as UserId | undefined;
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [conflicts, setConflicts] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  async function records() {
    if (!ownerId) throw new Error('account_required');
    const database = await localStoreManager.switchTo(ownerId);
    const result: BackupRecord[] = [];
    for (const entityType of entityTypes) {
      for (const entity of await database.listEntities(entityType))
        result.push({ entityType, id: entity.id, payload: entity.payload });
    }
    return result;
  }
  async function download() {
    try {
      const archive = createBackup(await records());
      const blob = new Blob([archive as BlobPart], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `grounded-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage('Backup created. Store it somewhere private.');
    } catch {
      setMessage('Could not create a backup on this device.');
    }
  }
  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const candidate = previewBackup(new Uint8Array(await file.arrayBuffer()));
      let existing = 0;
      if (ownerId) {
        const database = await localStoreManager.switchTo(ownerId);
        for (const record of candidate.records)
          if (await database.getEntity(record.entityType, record.id)) existing += 1;
      }
      setPreview(candidate);
      setConflicts(existing);
      setMessage(null);
    } catch {
      setPreview(null);
      setMessage('This file is not a valid Grounded backup. Nothing was imported.');
    }
  }
  async function restore() {
    if (!ownerId || !preview) return;
    const database = await localStoreManager.switchTo(ownerId);
    const repository = new LocalEntityRepository(database, clock, ids);
    let imported = 0;
    for (const record of preview.records) {
      if (await database.getEntity(record.entityType, record.id)) continue;
      await repository.save(record.entityType, record.id, record.payload);
      imported += 1;
    }
    setMessage(`${imported} records imported. ${conflicts} existing records were left unchanged.`);
    setPreview(null);
  }
  return (
    <Card aria-labelledby="data-settings-title">
      <div className="settings-section-heading">
        <p className="eyebrow">CONTROL</p>
        <h2 id="data-settings-title">Your data</h2>
        <p>Download a portable backup before changing or deleting important records.</p>
      </div>
      <dl className="data-summary">
        <div>
          <dt>Device storage</dt>
          <dd>Account-isolated, structured and available offline</dd>
        </div>
        <div>
          <dt>Cloud account</dt>
          <dd>Protected by owner-only and explicit-sharing database policies</dd>
        </div>
        <div>
          <dt>Backup format</dt>
          <dd>Grounded ZIP version 1 with an integrity-checked manifest and NDJSON records</dd>
        </div>
      </dl>
      <div className="data-actions">
        <section>
          <h3>Export backup</h3>
          <p>
            Includes health records from this device. The file is sensitive and is not encrypted.
          </p>
          <Button onClick={() => void download()}>Download backup</Button>
        </section>
        <section>
          <h3>Import backup</h3>
          <p>
            Grounded previews the archive first. Existing records are never silently overwritten.
          </p>
          <label className="file-picker">
            Choose Grounded ZIP
            <input
              accept=".zip,application/zip"
              onChange={(event) => void choose(event)}
              type="file"
            />
          </label>
          {preview ? (
            <div className="import-preview">
              <strong>{preview.manifest.recordCount} records found</strong>
              <p>
                Exported {new Date(preview.manifest.exportedAt).toLocaleString()} · {conflicts}{' '}
                already exist
              </p>
              <ul>
                {Object.entries(preview.counts).map(([type, count]) => (
                  <li key={type}>
                    {type}: {count}
                  </li>
                ))}
              </ul>
              <Button onClick={() => void restore()}>Import new records</Button>
              <Button onClick={() => setPreview(null)} variant="secondary">
                Cancel
              </Button>
            </div>
          ) : null}
        </section>
      </div>
      {message ? (
        <p
          className={
            message.startsWith('Could') || message.startsWith('This')
              ? 'form-error'
              : 'success-message'
          }
          role="status"
        >
          {message}
        </p>
      ) : null}
      <p className="settings-footnote">
        Imports are size-limited, checksum-verified and queued through the same sync path as
        ordinary edits.
      </p>
    </Card>
  );
}
