"use client";

import { OrganizationSwitcher, type OrganizationSwitcherItem } from "./organization-switcher";

export interface ChooseOrganizationProps {
  organizations: OrganizationSwitcherItem[];
  onSelect: (organizationId: string) => void;
  onCreate: () => void;
}

export function ChooseOrganization({ organizations, onSelect, onCreate }: ChooseOrganizationProps) {
  return (
    <OrganizationSwitcher
      organizations={organizations}
      activeOrganizationId={null}
      onSelect={onSelect}
      onCreate={onCreate}
    />
  );
}
