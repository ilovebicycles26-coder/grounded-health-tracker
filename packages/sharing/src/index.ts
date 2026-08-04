import type { IdGenerator } from '@grounded/application';
import { failure, type EntityId, type Result, type UserId } from '@grounded/domain';
export const shareableResources = ['weight_progress', 'routine_library', 'habit_progress'] as const;
export type ShareableResource = (typeof shareableResources)[number];
export interface Partner {
  readonly partnershipId: EntityId;
  readonly userId: UserId;
  readonly displayName: string;
}
export interface SharingGrant {
  readonly id: EntityId;
  readonly ownerId: UserId;
  readonly recipientId: UserId;
  readonly resource: ShareableResource;
  readonly active: boolean;
}
export interface SharedWeightSummary {
  readonly currentKilograms: number;
  readonly firstKilograms: number;
  readonly targetKilograms: number | null;
  readonly lastMeasuredOn: string;
}
export interface SharingRepository {
  createInvite(): Promise<Result<string>>;
  acceptInvite(code: string): Promise<Result<EntityId>>;
  listPartners(): Promise<Result<readonly Partner[]>>;
  listGrants(ownerId: UserId): Promise<Result<readonly SharingGrant[]>>;
  saveGrant(grant: SharingGrant): Promise<Result<SharingGrant>>;
  getSharedWeightSummary(partnerId: UserId): Promise<Result<SharedWeightSummary | null>>;
}
export class SharingService {
  public constructor(
    private readonly repository: SharingRepository,
    private readonly ids: IdGenerator,
  ) {}
  createInvite() {
    return this.repository.createInvite();
  }
  listPartners() {
    return this.repository.listPartners();
  }
  listGrants(ownerId: UserId) {
    return this.repository.listGrants(ownerId);
  }
  getSharedWeightSummary(partnerId: UserId) {
    return this.repository.getSharedWeightSummary(partnerId);
  }
  async acceptInvite(code: string) {
    const normalized = code.trim().toUpperCase();
    return /^[A-F0-9]{10}$/.test(normalized)
      ? this.repository.acceptInvite(normalized)
      : failure({ kind: 'validation', code: 'invalid_invite_code', field: 'code' });
  }
  async setGrant(
    ownerId: UserId,
    recipientId: UserId,
    resource: ShareableResource,
    active: boolean,
    existing?: SharingGrant,
  ) {
    if (ownerId === recipientId)
      return failure({ kind: 'validation', code: 'cannot_share_with_self' });
    return this.repository.saveGrant({
      id: existing?.id ?? (this.ids.create() as EntityId),
      ownerId,
      recipientId,
      resource,
      active,
    });
  }
}
