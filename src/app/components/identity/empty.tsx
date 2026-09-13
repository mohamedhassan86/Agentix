import { EmptyState } from "./empty-state";

export { EmptyState };

export function Empty(props: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <EmptyState
      title={props.title ?? "Nothing here yet"}
      description={props.description ?? "There are no items to show."}
      actionLabel={props.actionLabel}
      onAction={props.onAction}
    />
  );
}
