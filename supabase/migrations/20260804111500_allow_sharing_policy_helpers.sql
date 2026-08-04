-- RLS policy expressions execute with the caller's function privileges.
-- These helpers remain in the non-API `private` schema and are not callable over PostgREST.
grant execute on function private.has_active_partnership(uuid,uuid), private.can_access_shared_resource(uuid,uuid,text) to authenticated;
