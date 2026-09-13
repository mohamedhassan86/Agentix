import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET as listOrgs, POST as createOrg } from "@/app/api/v1/organizations/route";
import { GET as suggest } from "@/app/api/v1/organizations/slug-suggestion/route";
import { GET as getActive, PATCH as patchOrg, DELETE as deleteOrg } from "@/app/api/v1/organization/route";
import { GET as session } from "@/app/api/v1/session/route";
import { clearAppComposition, setAppCompositionForTests } from "@/app/lib/composition-root";
import { createIdentityHarness } from "../../../helpers/identity-harness";
import { registerAndSignIn } from "../../../helpers/identity-http";

describe("organization API", () => {
  beforeEach(() => {
    setAppCompositionForTests(createIdentityHarness().composition);
  });
  afterEach(() => {
    clearAppComposition();
  });

  it("creates unique org as Owner, becomes active, and conflicts on slug", async () => {
    const { cookie } = await registerAndSignIn("org@example.test");
    const empty = await listOrgs(new Request("http://localhost/api/v1/organizations", { headers: { Cookie: cookie } }));
    expect(empty.status).toBe(200);
    expect((await empty.json()).items).toEqual([]);

    const suggested = await suggest(
      new Request("http://localhost/api/v1/organizations/slug-suggestion?name=Alpha%20Org", { headers: { Cookie: cookie } }),
    );
    expect(suggested.status).toBe(200);
    expect((await suggested.json()).slug).toMatch(/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/);

    const created = await createOrg(
      new Request("http://localhost/api/v1/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ name: "Alpha Org", slug: "alpha-org" }),
      }),
    );
    expect(created.status).toBe(201);
    const profile = await created.json();
    expect(profile.currentRole).toBe("owner");

    const ctx = await session(new Request("http://localhost/api/v1/session", { headers: { Cookie: cookie } }));
    expect((await ctx.json()).activeOrganizationId).toBe(profile.id);

    const dup = await createOrg(
      new Request("http://localhost/api/v1/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ name: "Alpha Org", slug: "alpha-org" }),
      }),
    );
    expect(dup.status).toBe(409);
    expect((await dup.json()).code).toBe("SLUG_CONFLICT");
  });

  it("requires auth, owner-only rename/delete, and confirmation slug", async () => {
    const unauth = await createOrg(
      new Request("http://localhost/api/v1/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "X", slug: "xxx-org" }),
      }),
    );
    expect(unauth.status).toBe(401);

    const { cookie } = await registerAndSignIn("owner2@example.test");
    await createOrg(
      new Request("http://localhost/api/v1/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ name: "Beta Org", slug: "beta-org" }),
      }),
    );
    const renamed = await patchOrg(
      new Request("http://localhost/api/v1/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ name: "Beta Two" }),
      }),
    );
    expect(renamed.status).toBe(200);
    expect((await renamed.json()).name).toBe("Beta Two");

    const active = await getActive(new Request("http://localhost/api/v1/organization", { headers: { Cookie: cookie } }));
    expect((await active.json()).slug).toBe("beta-org");

    const deleted = await deleteOrg(
      new Request("http://localhost/api/v1/organization", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ confirmationSlug: "beta-org" }),
      }),
    );
    expect(deleted.status).toBe(204);
  });
});
