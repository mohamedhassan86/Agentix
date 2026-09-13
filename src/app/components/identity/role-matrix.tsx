const ROWS = [
  { action: "Invite teammates", owner: "Y", admin: "Y", member: "N", viewer: "N" },
  { action: "Change non-Owner role", owner: "Y", admin: "Y", member: "N", viewer: "N" },
  { action: "Remove non-Owner", owner: "Y", admin: "Y", member: "N", viewer: "N" },
  { action: "Leave organization", owner: "N", admin: "Y", member: "Y", viewer: "Y" },
  { action: "Transfer ownership", owner: "Y", admin: "N", member: "N", viewer: "N" },
  { action: "Rename / delete org", owner: "Y", admin: "N", member: "N", viewer: "N" },
];

export function RoleMatrix() {
  return (
    <table>
      <caption>Role permissions</caption>
      <thead>
        <tr>
          <th>Action</th>
          <th>Owner</th>
          <th>Admin</th>
          <th>Member</th>
          <th>Viewer</th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map((row) => (
          <tr key={row.action}>
            <td>{row.action}</td>
            <td>{row.owner}</td>
            <td>{row.admin}</td>
            <td>{row.member}</td>
            <td>{row.viewer}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
