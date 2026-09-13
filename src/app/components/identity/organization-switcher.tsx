"use client";

export interface OrganizationSwitcherItem {
  id: string;
  name: string;
  slug: string;
  currentRole: string | null;
}

export interface OrganizationSwitcherProps {
  organizations: OrganizationSwitcherItem[];
  activeOrganizationId: string | null;
  onSelect: (organizationId: string) => void;
  onCreate: () => void;
  disabled?: boolean;
}

export function OrganizationSwitcher({
  organizations,
  activeOrganizationId,
  onSelect,
  onCreate,
  disabled = false,
}: OrganizationSwitcherProps) {
  if (organizations.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h2>Organizations</h2>
        </div>
        <p style={{ color: "var(--muted)", marginBottom: "12px" }}>
          You have no organizations yet. Create one to become Owner.
        </p>
        <button className="btn btn-primary" type="button" onClick={onCreate} disabled={disabled}>
          Create organization
        </button>
      </div>
    );
  }

  const needsChoice = !activeOrganizationId;

  return (
    <div className="card">
      <div className="card-header">
        <h2>{needsChoice ? "Choose organization" : "Switch organization"}</h2>
        <button className="btn" type="button" onClick={onCreate} disabled={disabled}>
          Create
        </button>
      </div>
      {needsChoice ? (
        <p className="banner" role="status" aria-live="polite">
          You have memberships but no active organization. Choose one to continue.
        </p>
      ) : null}
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {organizations.map((org) => {
          const active = org.id === activeOrganizationId;
          return (
            <li key={org.id} style={{ marginBottom: "8px" }}>
              <button
                className="btn"
                type="button"
                disabled={disabled || active}
                aria-current={active ? "true" : undefined}
                onClick={() => onSelect(org.id)}
                title={active ? "Already the active organization" : `Switch to ${org.name}`}
              >
                {org.name} ({org.slug}) · {org.currentRole ?? "member"}
                {active ? " · active" : ""}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
