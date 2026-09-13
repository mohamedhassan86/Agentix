export interface DeliveryFailedProps {
  onResend?: () => void;
  disabledReason?: string;
}

export function DeliveryFailed({ onResend, disabledReason }: DeliveryFailedProps) {
  return (
    <div className="card" role="status" aria-live="polite">
      <div className="card-header">
        <h2>Delivery failed</h2>
        <span className="status-chip">
          <span className="dot" aria-hidden="true" />
          failed
        </span>
      </div>
      <p className="banner" style={{ marginBottom: onResend ? "12px" : 0 }}>
        The invitation is still pending. Delivery failed; resend to issue a new link.
      </p>
      {onResend ? (
        <button
          className="btn btn-primary"
          type="button"
          onClick={onResend}
          disabled={Boolean(disabledReason)}
          title={disabledReason}
        >
          Resend invitation
        </button>
      ) : null}
    </div>
  );
}
