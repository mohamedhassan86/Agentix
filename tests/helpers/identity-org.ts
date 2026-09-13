import { POST as createOrg } from "@/app/api/v1/organizations/route";
import { POST as createInvite } from "@/app/api/v1/organization/invitations/route";
import { POST as acceptInvite } from "@/app/api/v1/invitations/[invitationId]/accept/route";
import type { MemoryIdentityStore } from "./memory-identity-store";
import { registerAndSignIn } from "./identity-http";

export async function createOwnedOrganization(email: string, slug: string): Promise<{ cookie: string }> {
  const { cookie } = await registerAndSignIn(email);
  const created = await createOrg(
    new Request("http://localhost/api/v1/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ name: slug, slug }),
    }),
  );
  if (created.status !== 201) throw new Error(`create org failed ${created.status}`);
  return { cookie };
}

export async function inviteAndAccept(params: {
  ownerCookie: string;
  store: MemoryIdentityStore;
  email: string;
  role: "viewer" | "member" | "admin";
}): Promise<{ cookie: string; invitationId: string }> {
  const invited = await createInvite(
    new Request("http://localhost/api/v1/organization/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: params.ownerCookie },
      body: JSON.stringify({ email: params.email, role: params.role }),
    }),
  );
  const invitation = await invited.json();
  const token = params.store.lastCapturedToken()!;
  const { cookie } = await registerAndSignIn(params.email);
  const accepted = await acceptInvite(
    new Request(`http://localhost/api/v1/invitations/${invitation.id}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ token }),
    }),
    { params: { invitationId: invitation.id } },
  );
  if (accepted.status !== 200) throw new Error(`accept failed ${accepted.status}`);
  return { cookie, invitationId: invitation.id };
}

export { switchOrg };
