-- Migration 002_tenancy_identity
-- Additive migration for tenancy & identity

-- CreateEnum organization_role
CREATE TYPE "organization_role" AS ENUM ('viewer', 'member', 'admin', 'owner');

-- CreateEnum invitable_role
CREATE TYPE "invitable_role" AS ENUM ('viewer', 'member', 'admin');

-- CreateEnum invitation_status
CREATE TYPE "invitation_status" AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- CreateEnum delivery_state
CREATE TYPE "delivery_state" AS ENUM ('queued', 'sent', 'failed');

-- CreateEnum membership_end_reason
CREATE TYPE "membership_end_reason" AS ENUM ('left', 'removed', 'organization_deleted', 'account_deleted');

-- CreateEnum token_purpose
CREATE TYPE "token_purpose" AS ENUM ('email_verification', 'invitation_acceptance');

-- CreateEnum identity_event_type
CREATE TYPE "identity_event_type" AS ENUM (
  'account_registered',
  'account_email_verified',
  'account_deleted',
  'organization_created',
  'organization_profile_changed',
  'organization_ownership_transferred',
  'organization_deleted',
  'membership_joined',
  'membership_role_changed',
  'membership_removed',
  'membership_left',
  'invitation_created',
  'invitation_resent',
  'invitation_revoked',
  'invitation_expired',
  'invitation_accepted',
  'message_delivery_succeeded',
  'message_delivery_failed'
);

-- Alter outbox_messages add identity extension columns
ALTER TABLE "outbox_messages" ADD COLUMN "message_kind" VARCHAR(50);
ALTER TABLE "outbox_messages" ADD COLUMN "recipient_hash" VARCHAR(200);
ALTER TABLE "outbox_messages" ADD COLUMN "ciphertext" BYTEA;
ALTER TABLE "outbox_messages" ADD COLUMN "nonce" BYTEA;
ALTER TABLE "outbox_messages" ADD COLUMN "tag" BYTEA;
ALTER TABLE "outbox_messages" ADD COLUMN "key_version" SMALLINT;
ALTER TABLE "outbox_messages" ADD COLUMN "encrypted_at" TIMESTAMPTZ;

CREATE INDEX "outbox_message_kind_idx" ON "outbox_messages"("message_kind", "created_at");

-- CreateTable users
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email_normalized" TEXT NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "email_verified_at" TIMESTAMPTZ,
    "is_platform_admin" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_email_normalized_check" CHECK ("email_normalized" <> '' AND LENGTH("email_normalized") <= 254),
    CONSTRAINT "users_display_name_check" CHECK (LENGTH("display_name") BETWEEN 1 AND 120),
    CONSTRAINT "users_password_hash_check" CHECK (LENGTH("password_hash") > 0),
    CONSTRAINT "users_version_check" CHECK ("version" >= 1)
);

CREATE UNIQUE INDEX "users_email_normalized_unique" ON "users"("email_normalized");
CREATE INDEX "user_platform_admin_idx" ON "users"("is_platform_admin", "deleted_at");

-- CreateTable organizations
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(48) NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "organizations_name_check" CHECK (LENGTH("name") BETWEEN 1 AND 120),
    CONSTRAINT "organizations_slug_check" CHECK ("slug" ~ '^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$' AND LENGTH("slug") BETWEEN 3 AND 48),
    CONSTRAINT "organizations_version_check" CHECK ("version" >= 1)
);

CREATE UNIQUE INDEX "organizations_slug_unique" ON "organizations"("slug");
CREATE INDEX "organization_created_idx" ON "organizations"("created_at", "id");

-- CreateTable memberships
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "organization_role" NOT NULL,
    "joined_at" TIMESTAMPTZ NOT NULL,
    "ended_at" TIMESTAMPTZ,
    "end_reason" "membership_end_reason",
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "memberships_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "memberships_version_check" CHECK ("version" >= 1),
    CONSTRAINT "memberships_ended_check" CHECK (
        ("ended_at" IS NULL AND "end_reason" IS NULL) OR
        ("ended_at" IS NOT NULL AND "end_reason" IS NOT NULL)
    )
);

-- Partial unique: one active membership per org+user
CREATE UNIQUE INDEX "membership_active_org_user_unique" ON "memberships"("org_id", "user_id") WHERE "ended_at" IS NULL;
-- Partial unique: at most one active owner per org
CREATE UNIQUE INDEX "membership_active_owner_unique" ON "memberships"("org_id") WHERE "role" = 'owner' AND "ended_at" IS NULL;
CREATE INDEX "membership_org_user_idx" ON "memberships"("org_id", "user_id");
CREATE INDEX "membership_org_role_idx" ON "memberships"("org_id", "role", "ended_at", "user_id");
CREATE INDEX "membership_user_org_idx" ON "memberships"("user_id", "ended_at", "org_id");
CREATE INDEX "membership_org_created_idx" ON "memberships"("org_id", "created_at", "id");

-- CreateTable invitations
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "email_normalized" TEXT NOT NULL,
    "role" "invitable_role" NOT NULL,
    "status" "invitation_status" NOT NULL DEFAULT 'pending',
    "inviter_user_id" UUID NOT NULL,
    "accepted_user_id" UUID,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "accepted_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "delivery_state" "delivery_state" NOT NULL DEFAULT 'queued',
    "last_delivery_error_code" VARCHAR(120),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "invitations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "invitations_inviter_fkey" FOREIGN KEY ("inviter_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "invitations_accepted_user_fkey" FOREIGN KEY ("accepted_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "invitations_email_check" CHECK ("email_normalized" <> '' AND LENGTH("email_normalized") <= 254),
    CONSTRAINT "invitations_version_check" CHECK ("version" >= 1),
    CONSTRAINT "invitations_status_timestamp_check" CHECK (
        ("status" = 'accepted' AND "accepted_at" IS NOT NULL) OR
        ("status" != 'accepted' AND "accepted_at" IS NULL) OR
        ("status" = 'accepted' AND "accepted_at" IS NOT NULL)
    ),
    CONSTRAINT "invitations_revoked_check" CHECK (
        ("status" = 'revoked' AND "revoked_at" IS NOT NULL) OR
        ("status" != 'revoked' AND "revoked_at" IS NULL) OR
        ("status" = 'revoked')
    )
);

-- Partial unique: at most one pending per org+email
CREATE UNIQUE INDEX "invitation_pending_org_email_unique" ON "invitations"("org_id", "email_normalized") WHERE "status" = 'pending';
CREATE INDEX "invitation_org_status_idx" ON "invitations"("org_id", "status", "created_at", "id");
CREATE INDEX "invitation_org_email_status_idx" ON "invitations"("org_id", "email_normalized", "status");
CREATE INDEX "invitation_created_idx" ON "invitations"("created_at", "id");

-- CreateTable one_time_tokens
CREATE TABLE "one_time_tokens" (
    "id" UUID NOT NULL,
    "purpose" "token_purpose" NOT NULL,
    "user_id" UUID,
    "invitation_id" UUID,
    "org_id" UUID,
    "token_digest" BYTEA NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "one_time_tokens_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "one_time_tokens_invitation_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "one_time_tokens_org_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "one_time_tokens_version_check" CHECK ("version" >= 1),
    CONSTRAINT "one_time_tokens_purpose_check" CHECK (
        ("purpose" = 'email_verification' AND "user_id" IS NOT NULL AND "invitation_id" IS NULL) OR
        ("purpose" = 'invitation_acceptance' AND "invitation_id" IS NOT NULL AND "org_id" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "token_purpose_digest_unique" ON "one_time_tokens"("purpose", "token_digest");
CREATE INDEX "token_org_invitation_version_idx" ON "one_time_tokens"("org_id", "invitation_id", "version" DESC);
CREATE INDEX "token_user_purpose_version_idx" ON "one_time_tokens"("user_id", "purpose", "version" DESC);
CREATE INDEX "token_expires_idx" ON "one_time_tokens"("expires_at");

-- CreateTable sessions
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "session_token_digest" BYTEA NOT NULL,
    "user_id" UUID NOT NULL,
    "active_org_id" UUID,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "last_seen_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "revoked_at" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sessions_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sessions_version_check" CHECK ("version" >= 1)
);

CREATE UNIQUE INDEX "sessions_token_digest_unique" ON "sessions"("session_token_digest");
CREATE INDEX "session_user_revoked_expires_idx" ON "sessions"("user_id", "revoked_at", "expires_at");
CREATE INDEX "session_active_org_revoked_idx" ON "sessions"("active_org_id", "revoked_at");
CREATE INDEX "session_created_idx" ON "sessions"("created_at", "id");

-- CreateTable login_throttles
CREATE TABLE "login_throttles" (
    "email_key" BYTEA NOT NULL,
    "failed_count" SMALLINT NOT NULL DEFAULT 0,
    "window_started_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "locked_until" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "login_throttles_pkey" PRIMARY KEY ("email_key"),
    CONSTRAINT "login_throttles_failed_count_check" CHECK ("failed_count" >= 0 AND "failed_count" <= 5)
);

CREATE INDEX "throttle_locked_until_idx" ON "login_throttles"("locked_until");
CREATE INDEX "throttle_updated_idx" ON "login_throttles"("updated_at");

-- CreateTable identity_events
CREATE TABLE "identity_events" (
    "id" UUID NOT NULL,
    "org_id" UUID,
    "actor_user_id" UUID,
    "subject_user_id" UUID,
    "event_type" "identity_event_type" NOT NULL,
    "object_type" VARCHAR(50) NOT NULL,
    "object_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "sequence" BIGINT NOT NULL,

    CONSTRAINT "identity_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "identity_events_org_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "identity_events_actor_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "identity_events_subject_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "identity_event_org_sequence_idx" ON "identity_events"("org_id", "sequence");
CREATE INDEX "identity_event_subject_time_idx" ON "identity_events"("subject_user_id", "occurred_at", "id");
CREATE INDEX "identity_event_type_time_idx" ON "identity_events"("event_type", "occurred_at");
CREATE INDEX "identity_event_occurred_idx" ON "identity_events"("occurred_at", "id");

-- Trigger: platform admin requires zero active memberships
CREATE OR REPLACE FUNCTION check_platform_admin_zero_memberships()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."is_platform_admin" = true THEN
    IF EXISTS (
      SELECT 1 FROM "memberships"
      WHERE "user_id" = NEW."id" AND "ended_at" IS NULL
    ) THEN
      RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRES_ZERO_MEMBERSHIPS: user % has active memberships', NEW."id"
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_platform_admin_check
BEFORE INSERT OR UPDATE OF "is_platform_admin" ON "users"
FOR EACH ROW
EXECUTE FUNCTION check_platform_admin_zero_memberships();

-- Trigger: prevent active membership for platform admin
CREATE OR REPLACE FUNCTION check_membership_platform_admin()
RETURNS TRIGGER AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  IF NEW."ended_at" IS NULL THEN
    SELECT "is_platform_admin" INTO is_admin FROM "users" WHERE "id" = NEW."user_id";
    IF is_admin = true THEN
      RAISE EXCEPTION 'PLATFORM_ADMIN_CANNOT_HAVE_MEMBERSHIP: user % is platform admin', NEW."user_id"
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memberships_platform_admin_check
BEFORE INSERT OR UPDATE ON "memberships"
FOR EACH ROW
EXECUTE FUNCTION check_membership_platform_admin();

-- Trigger: organization owner invariant - deferred at commit
CREATE OR REPLACE FUNCTION check_organization_owner_invariant()
RETURNS TRIGGER AS $$
DECLARE
  org_record RECORD;
  owner_count INT;
  owner_user_id_match BOOLEAN;
BEGIN
  -- For each non-deleted organization, check exactly one active owner and owner_user_id matches
  FOR org_record IN SELECT "id", "owner_user_id" FROM "organizations" WHERE "deleted_at" IS NULL LOOP
    SELECT COUNT(*) INTO owner_count
    FROM "memberships"
    WHERE "org_id" = org_record."id" AND "role" = 'owner' AND "ended_at" IS NULL;

    IF owner_count != 1 THEN
      RAISE EXCEPTION 'OWNER_INVARIANT: organization % must have exactly one active owner, found %', org_record."id", owner_count
        USING ERRCODE = '23514';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM "memberships"
      WHERE "org_id" = org_record."id" AND "user_id" = org_record."owner_user_id" AND "role" = 'owner' AND "ended_at" IS NULL
    ) INTO owner_user_id_match;

    IF NOT owner_user_id_match THEN
      RAISE EXCEPTION 'OWNER_INVARIANT: organization % owner_user_id % does not match active owner membership', org_record."id", org_record."owner_user_id"
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Deferred constraint trigger that runs at end of transaction
CREATE CONSTRAINT TRIGGER organization_owner_invariant_deferred
AFTER INSERT OR UPDATE OR DELETE ON "memberships"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_organization_owner_invariant();

CREATE CONSTRAINT TRIGGER organization_owner_invariant_org_deferred
AFTER INSERT OR UPDATE OF "owner_user_id", "deleted_at" ON "organizations"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_organization_owner_invariant();

-- Immutable identity_events: prevent UPDATE and DELETE
CREATE OR REPLACE FUNCTION prevent_identity_events_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'identity_events is append-only and immutable'
    USING ERRCODE = '23514';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER identity_events_immutable_update
BEFORE UPDATE ON "identity_events"
FOR EACH ROW
EXECUTE FUNCTION prevent_identity_events_mutation();

CREATE TRIGGER identity_events_immutable_delete
BEFORE DELETE ON "identity_events"
FOR EACH ROW
EXECUTE FUNCTION prevent_identity_events_mutation();

-- Function to materialize expired invitations (called in application transaction, but also as helper)
-- No automatic scheduler; effective expiry derived from expires_at, but we provide a function for cleanup

-- Add check for ended_at/end_reason already in table constraint

-- Ensure slug remains reserved even after logical delete - unique index already covers deleted rows
