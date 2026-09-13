"use client";

import { useEffect, useState } from "react";
import { VerificationState, type VerificationUiStatus } from "@/app/components/identity/verification-state";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<VerificationUiStatus>("loading");
  const [detail, setDetail] = useState<string | undefined>();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("ready");
      return;
    }
    fetch("/api/v1/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (!res.ok) {
          setStatus("error");
          const problem = await res.json().catch(() => ({}));
          setDetail(problem.title ?? "Invalid token");
          return;
        }
        const body = await res.json();
        setStatus(body.status === "already_verified" ? "already_verified" : "verified");
      })
      .catch(() => {
        setStatus("error");
        setDetail("Verification failed");
      });
  }, []);

  return <VerificationState status={status} detail={detail} />;
}
