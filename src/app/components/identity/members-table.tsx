export interface MemberRow {
  id: string;
  displayName: string;
  email: string;
  role: string;
}

export interface MembersTableProps {
  members: MemberRow[];
}

export function MembersTable({ members }: MembersTableProps) {
  if (members.length === 0) {
    return <p style={{ color: "var(--muted)" }}>No members.</p>;
  }
  return (
    <table>
      <caption className="card-header">Members</caption>
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
        </tr>
      </thead>
      <tbody>
        {members.map((member) => (
          <tr key={member.id}>
            <td>{member.displayName}</td>
            <td>{member.email}</td>
            <td>
              <span className="status-chip">
                <span className="dot" />
                {member.role}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
