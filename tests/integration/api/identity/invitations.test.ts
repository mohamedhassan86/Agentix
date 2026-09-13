import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST as createOrg } from "@/app/api/v1/organizations/route";
import { GET as listInvites, POST as createInvite } from "@/app/api/v1/organization/invitations/route";
import { POST as resendInvite } from "@/app/api/v1/organization/invitations/[invitationId]/resend/route";
import { POST as revokeInvite } from "@/app/api/v1/organization/invitations/[invitationId]/revoke/route";
import { GET as previewInvite } from "@/app/api/v1/invitations/[invitationId]/route";
import { POST as acceptInvite } from "@/app/api/v1/invitations/[invitationId]/accept/route";
import { GET as session } from "@/app/api/v1/session/route";
import { clearAppComposition, setAppCompositionForTests } from "@/app/lib/composition-root";
import { createIdentityHarness, type IdentityHarness } from "../../../helpers/identity-harness";
import { registerAndSignIn } from "../../../helpers/identity-http";

describe("invitation API", () => {
  let harness: IdentityHarness;

  beforeEach(() => {
    harness = createIdentityHarness();
    setAppCompositionForTests(harness.composition);
  });
  afterEach(() => {
    clearAppComposition();
  });

  async function ownerCookie(): Promise<string> {
    const { cookie } = await registerAndSignIn("owner@example.test");
    await createOrg(
      new Request("http://localhost/api/v1/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ name: "Alpha Org", slug: "alpha-org" }),
      }),
    );
    return cookie;
  }

  it("Owner invites, pending is listed, accept does not auto-switch", async () => {
    const cookie = await ownerCookie();
    const invited = await createInvite(
      new Request("http://localhost/api/v1/organization/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ email: "admin@example.test", role: "admin" }),
      }),
    );
    expect(invited.status).toBe(201);
    const invitation = await invited.json();
    expect(invitation.status).toBe("pending");
    expect(JSON.stringify(invitation)).not.toMatch(/tokenDigest|supersecret/);

    const listed = await listInvites(new Request("http://localhost/api/v1/organization/invitations", { headers: { Cookie: cookie } }));
    expect(listed.status).toBe(200);
    expect((await listed.json()).items).toHaveLength(1);

    const dup = await createInvite(
      new Request("http://localhost/api/v1/organization/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ email: "admin@example.test", role: "member" }),
      }),
    );
    expect(dup.status).toBe(409);
    expect((await dup.json()).code).toBe("INVITATION_CONFLICT");

    const token = harness.store.lastCapturedToken()!;
    const preview = await previewInvite(
      new Request(`http://localhost/api/v1/invitations/${invitation.id}?token=${encodeURIComponent(token)}`),
      { params: { invitationId: invitation.id } },
    );
    expect(preview.status).toBe(200);
    expect((await preview.json()).invitedEmail).toBe("admin@example.test");

    const { cookie: inviteeCookie } = await registerAndSignIn("admin@example.test");
    const accepted = await acceptInvite(
      new Request(`http://localhost/api/v1/invitations/${invitation.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: inviteeCookie },
        body: JSON.stringify({ token }),
      }),
      { params: { invitationId: invitation.id } },
    );
    expect(accepted.status).toBe(200);
    const body = await accepted.json();
    expect(body.activeOrganizationChanged).toBe(false);
    expect(body.membership.role).toBe("admin");
    const ctx = await session(new Request("http://localhost/api/v1/session", { headers: { Cookie: inviteeCookie } }));
    expect((await ctx.json()).activeOrganizationId).toBeNull();
  });

  it("resend rotates token, revoke blocks accept, member cannot invite", async () => {
    const cookie = await ownerCookie();
    const invited = await createInvite(
      new Request("http://localhost/api/v1/organization/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ email: "member@example.test", role: "member" }),
      }),
    );
    const invitation = await invited.json();
    const oldToken = harness.store.lastCapturedToken()!;
    const resent = await resendInvite(
      new Request(`http://localhost/api/v1/organization/invitations/${invitation.id}/resend`, { method: "POST", headers: { Cookie: cookie } }),
      { params: { invitationId: invitation.id } },
    );
    expect(resent.status).toBe(202);
    const newToken = harness.store.lastCapturedToken()!;
    expect(newToken).not.toBe(oldToken);

    const revokedInvite = await createInvite(
      new Request("http://localhost/api/v1/organization/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ email: "gone@example.test", role: "viewer" }),
      }),
    );
    const revokedBody = await revokedInvite.json();
    const revokedToken = harness.store.lastCapturedToken()!;
    const revoked = await revokeInvite(
      new Request(`http://localhost/api/v1/organization/invitations/${revokedBody.id}/revoke`, { method: "POST", headers: { Cookie: cookie } }),
      { params: { invitationId: revokedBody.id } },
    );
    expect(revoked.status).toBe(200);

    const { cookie: goneCookie } = await registerAndSignIn("gone@example.test");
    const acceptRevoked = await acceptInvite(
      new Request(`http://localhost/api/v1/invitations/${revokedBody.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: goneCookie },
        body: JSON.stringify({ token: revokedToken }),
      }),
      { params: { invitationId: revokedBody.id } },
    );
    expect(acceptRevoked.status).toBeGreaterThanOrEqual(400);
  });
});
