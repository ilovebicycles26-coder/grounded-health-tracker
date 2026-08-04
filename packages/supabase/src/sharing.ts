import { failure, success, type EntityId, type Result, type UserId } from '@grounded/domain';
import type {
  Partner,
  SharedWeightSummary,
  SharingGrant,
  SharingRepository,
} from '@grounded/sharing';
import type { GroundedSupabaseClient } from './index';
const unavailable = <T>(code: string): Result<T> => failure({ kind: 'unavailable', code });
export class SupabaseSharingRepository implements SharingRepository {
  public constructor(
    private readonly client: GroundedSupabaseClient,
    private readonly ownerId: UserId,
  ) {}
  async createInvite() {
    const { data, error } = await this.client.rpc('create_partner_invite');
    return error || !data ? unavailable<string>('sharing_invite_failed') : success(data);
  }
  async acceptInvite(code: string) {
    const { data, error } = await this.client.rpc('accept_partner_invite', { invite_code: code });
    return error || !data
      ? unavailable<EntityId>('sharing_accept_failed')
      : success(data as EntityId);
  }
  async listPartners() {
    const { data, error } = await this.client.rpc('list_my_partners');
    if (error) return unavailable<readonly Partner[]>('sharing_partners_failed');
    return success(
      data.map((row) => ({
        partnershipId: row.partnership_id as EntityId,
        userId: row.partner_user_id as UserId,
        displayName: row.display_name,
      })),
    );
  }
  async listGrants(ownerId: UserId) {
    if (ownerId !== this.ownerId)
      return unavailable<readonly SharingGrant[]>('sharing_owner_mismatch');
    const { data, error } = await this.client
      .from('sharing_grants')
      .select('*')
      .eq('owner_user_id', ownerId);
    if (error) return unavailable<readonly SharingGrant[]>('sharing_grants_failed');
    return success(
      data.map((row) => ({
        id: row.id as EntityId,
        ownerId: row.owner_user_id as UserId,
        recipientId: row.recipient_user_id as UserId,
        resource: row.resource_type,
        active: row.revoked_at === null,
      })),
    );
  }
  async saveGrant(grant: SharingGrant) {
    if (grant.ownerId !== this.ownerId) return unavailable<SharingGrant>('sharing_owner_mismatch');
    const { data, error } = await this.client
      .from('sharing_grants')
      .upsert(
        {
          id: grant.id,
          owner_user_id: grant.ownerId,
          recipient_user_id: grant.recipientId,
          resource_type: grant.resource,
          permission: 'view',
          revoked_at: grant.active ? null : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'owner_user_id,recipient_user_id,resource_type' },
      )
      .select('*')
      .single();
    return error
      ? unavailable<SharingGrant>('sharing_grant_save_failed')
      : success({
          id: data.id as EntityId,
          ownerId: data.owner_user_id as UserId,
          recipientId: data.recipient_user_id as UserId,
          resource: data.resource_type,
          active: data.revoked_at === null,
        });
  }
  async getSharedWeightSummary(partnerId: UserId) {
    const { data, error } = await this.client.rpc('get_shared_weight_summary', {
      target_user: partnerId,
    });
    if (error) return unavailable<SharedWeightSummary | null>('shared_weight_failed');
    const [row] = data;
    return success(
      row
        ? {
            currentKilograms: Number(row.current_weight_kg),
            firstKilograms: Number(row.first_weight_kg),
            targetKilograms: row.target_weight_kg === null ? null : Number(row.target_weight_kg),
            lastMeasuredOn: row.last_measured_on,
          }
        : null,
    );
  }
}
