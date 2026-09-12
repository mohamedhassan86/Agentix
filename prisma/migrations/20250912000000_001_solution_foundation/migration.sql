-- CreateEnum
CREATE TYPE "work_scope" AS ENUM ('global', 'tenant');

-- CreateEnum
CREATE TYPE "outbox_status" AS ENUM ('pending', 'processing', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "attempt_outcome" AS ENUM ('succeeded', 'retry_scheduled', 'failed', 'cancelled', 'lease_expired');

-- CreateTable outbox_messages
CREATE TABLE "outbox_messages" (
    "id" UUID NOT NULL,
    "work_type" VARCHAR(120) NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "scope" "work_scope" NOT NULL,
    "org_id" UUID,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "correlation_id" UUID NOT NULL,
    "trace_parent" VARCHAR(55),
    "trace_state" VARCHAR(512),
    "payload" JSONB NOT NULL,
    "status" "outbox_status" NOT NULL DEFAULT 'pending',
    "available_at" TIMESTAMPTZ NOT NULL,
    "attempt_count" SMALLINT NOT NULL DEFAULT 0,
    "max_attempts" SMALLINT NOT NULL DEFAULT 3,
    "lease_owner" VARCHAR(120),
    "lease_expires_at" TIMESTAMPTZ,
    "last_error_code" VARCHAR(120),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "outbox_work_type_check" CHECK ("work_type" <> '' AND LENGTH("work_type") BETWEEN 1 AND 120),
    CONSTRAINT "outbox_schema_version_check" CHECK ("schema_version" >= 1),
    CONSTRAINT "outbox_idempotency_key_check" CHECK (LENGTH("idempotency_key") BETWEEN 1 AND 200),
    CONSTRAINT "outbox_scope_org_check" CHECK (
        ("scope" = 'global' AND "org_id" IS NULL) OR
        ("scope" = 'tenant' AND "org_id" IS NOT NULL)
    ),
    CONSTRAINT "outbox_attempt_count_check" CHECK ("attempt_count" >= 0 AND "attempt_count" <= "max_attempts"),
    CONSTRAINT "outbox_max_attempts_check" CHECK ("max_attempts" BETWEEN 1 AND 10),
    CONSTRAINT "outbox_lease_check" CHECK (
        ("status" = 'processing' AND "lease_owner" IS NOT NULL AND "lease_expires_at" IS NOT NULL) OR
        ("status" != 'processing' AND "lease_owner" IS NULL AND "lease_expires_at" IS NULL)
    ),
    CONSTRAINT "outbox_terminal_check" CHECK (
        ("status" IN ('succeeded', 'failed') AND "completed_at" IS NOT NULL) OR
        ("status" IN ('pending', 'processing') AND "completed_at" IS NULL)
    ),
    CONSTRAINT "outbox_trace_parent_length" CHECK ("trace_parent" IS NULL OR LENGTH("trace_parent") <= 55),
    CONSTRAINT "outbox_trace_state_length" CHECK ("trace_state" IS NULL OR LENGTH("trace_state") <= 512),
    CONSTRAINT "outbox_last_error_code_length" CHECK ("last_error_code" IS NULL OR LENGTH("last_error_code") BETWEEN 1 AND 120)
);

-- CreateTable outbox_attempts
CREATE TABLE "outbox_attempts" (
    "id" UUID NOT NULL,
    "outbox_id" UUID NOT NULL,
    "org_id" UUID,
    "attempt_number" SMALLINT NOT NULL,
    "worker_id" VARCHAR(120) NOT NULL,
    "claimed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "finished_at" TIMESTAMPTZ,
    "outcome" "attempt_outcome",
    "error_code" VARCHAR(120),
    "next_available_at" TIMESTAMPTZ,
    "duration_ms" INTEGER,

    CONSTRAINT "outbox_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "outbox_attempts_attempt_number_check" CHECK ("attempt_number" >= 1),
    CONSTRAINT "outbox_attempts_duration_check" CHECK ("duration_ms" IS NULL OR "duration_ms" >= 0),
    CONSTRAINT "outbox_attempts_error_code_length" CHECK ("error_code" IS NULL OR LENGTH("error_code") BETWEEN 1 AND 120),
    CONSTRAINT "outbox_attempts_worker_id_check" CHECK (LENGTH("worker_id") BETWEEN 1 AND 120),
    CONSTRAINT "outbox_attempts_finished_outcome_check" CHECK (
        ("finished_at" IS NULL AND "outcome" IS NULL) OR
        ("finished_at" IS NOT NULL AND "outcome" IS NOT NULL)
    ),
    CONSTRAINT "outbox_attempts_retry_next_available_check" CHECK (
        ("outcome" != 'retry_scheduled') OR
        ("outcome" = 'retry_scheduled' AND "next_available_at" IS NOT NULL)
    )
);

-- CreateTable foundation_demo_requests
CREATE TABLE "foundation_demo_requests" (
    "id" UUID NOT NULL,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "correlation_id" UUID NOT NULL,
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "foundation_demo_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "foundation_demo_requests_idempotency_key_check" CHECK (LENGTH("idempotency_key") BETWEEN 1 AND 200)
);

-- CreateTable foundation_demo_effects
CREATE TABLE "foundation_demo_effects" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "outbox_id" UUID NOT NULL,
    "correlation_id" UUID NOT NULL,
    "applied_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "foundation_demo_effects_pkey" PRIMARY KEY ("id")
);

-- Idempotency uniqueness using normalized owner (nil UUID for global)
-- nil UUID = 00000000-0000-0000-0000-000000000000
CREATE UNIQUE INDEX "outbox_idempotency_unique_idx" ON "outbox_messages" ("work_type", "scope", COALESCE("org_id", '00000000-0000-0000-0000-000000000000'::uuid), "idempotency_key");

-- Partial indexes for claim and lease recovery
CREATE INDEX "outbox_pending_due_idx" ON "outbox_messages" ("available_at", "created_at", "id") WHERE "status" = 'pending';
CREATE INDEX "outbox_processing_lease_idx" ON "outbox_messages" ("lease_expires_at", "id") WHERE "status" = 'processing';

-- Tenant-leading and correlation indexes
CREATE INDEX "outbox_org_idx" ON "outbox_messages" ("org_id", "created_at", "id") WHERE "org_id" IS NOT NULL;
CREATE INDEX "outbox_correlation_idx" ON "outbox_messages" ("correlation_id", "created_at", "id");
CREATE INDEX "outbox_status_completed_idx" ON "outbox_messages" ("status", "completed_at");

-- Outbox attempts indexes
CREATE UNIQUE INDEX "outbox_attempt_number_unique" ON "outbox_attempts" ("outbox_id", "attempt_number");
CREATE INDEX "attempt_org_idx" ON "outbox_attempts" ("org_id", "claimed_at", "id") WHERE "org_id" IS NOT NULL;
CREATE INDEX "attempt_outbox_idx" ON "outbox_attempts" ("outbox_id", "claimed_at");

-- Foundation demo indexes
CREATE UNIQUE INDEX "foundation_demo_requests_idempotency_key_key" ON "foundation_demo_requests" ("idempotency_key");
CREATE INDEX "demo_request_correlation_idx" ON "foundation_demo_requests" ("correlation_id", "requested_at");

CREATE UNIQUE INDEX "foundation_demo_effects_request_id_key" ON "foundation_demo_effects" ("request_id");
CREATE UNIQUE INDEX "foundation_demo_effects_outbox_id_key" ON "foundation_demo_effects" ("outbox_id");
CREATE INDEX "demo_effect_correlation_idx" ON "foundation_demo_effects" ("correlation_id", "applied_at");

-- Foreign Keys
ALTER TABLE "outbox_attempts" ADD CONSTRAINT "outbox_attempts_outbox_id_fkey" FOREIGN KEY ("outbox_id") REFERENCES "outbox_messages" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "foundation_demo_effects" ADD CONSTRAINT "foundation_demo_effects_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "foundation_demo_requests" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "foundation_demo_effects" ADD CONSTRAINT "foundation_demo_effects_outbox_id_fkey" FOREIGN KEY ("outbox_id") REFERENCES "outbox_messages" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Updated_at trigger for outbox_messages
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_outbox_messages_updated_at BEFORE UPDATE ON "outbox_messages" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_foundation_demo_requests_updated_at BEFORE UPDATE ON "foundation_demo_requests" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
