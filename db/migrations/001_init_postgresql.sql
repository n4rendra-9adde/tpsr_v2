-- =============================================================
-- TPSR Phase-2 Migration 001 — Initial PostgreSQL Schema
-- =============================================================
-- This migration creates the core off-chain storage model for TPSR.
-- PostgreSQL is the authoritative store for full SBOM documents,
-- artifact provenance, verification events, and compliance reports.
-- Hyperledger Fabric remains the immutable trust anchor.
-- =============================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================
-- TABLE: sbom_documents
-- Stores full SBOM JSON, metadata, and CI provenance.
-- =============================================================
CREATE TABLE sbom_documents (
    id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    sbom_id                VARCHAR(255)  NOT NULL UNIQUE,
    build_id               VARCHAR(255)  NOT NULL,
    software_name          VARCHAR(255)  NOT NULL,
    software_version       VARCHAR(100)  NOT NULL,
    format                 VARCHAR(32)   NOT NULL
                               CHECK (format IN ('SPDX', 'CycloneDX')),
    status                 VARCHAR(32)   NOT NULL DEFAULT 'PENDING'
                               CHECK (status IN ('PENDING', 'APPROVED', 'ACTIVE', 'SUPERSEDED')),
    sbom_hash              CHAR(64)      NOT NULL,
    sbom_json              JSONB         NOT NULL,
    submitter_id           TEXT,
    requested_by           VARCHAR(255),
    job_name               VARCHAR(255),
    build_number           VARCHAR(100),
    git_commit             VARCHAR(64),
    git_branch             VARCHAR(255),
    repository_url         TEXT,
    off_chain_ref          TEXT,
    fabric_tx_id           VARCHAR(128),
    fabric_channel         VARCHAR(128)  NOT NULL DEFAULT 'tpsrchannel',
    fabric_chaincode       VARCHAR(128)  NOT NULL DEFAULT 'sbom',
    signatures             JSONB         NOT NULL DEFAULT '[]'::jsonb,
    canonicalization_version VARCHAR(50) NOT NULL DEFAULT 'v1',
    created_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- =============================================================
-- TABLE: artifact_records
-- Stores artifact hash and provenance bound to an SBOM submission.
-- =============================================================
CREATE TABLE artifact_records (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    sbom_document_id   UUID         NOT NULL REFERENCES sbom_documents(id) ON DELETE CASCADE,
    artifact_type      VARCHAR(32)  NOT NULL
                           CHECK (artifact_type IN ('JAR', 'IMAGE', 'BINARY', 'ARCHIVE', 'OTHER')),
    artifact_name      TEXT         NOT NULL,
    artifact_hash      CHAR(64)     NOT NULL,
    artifact_uri       TEXT,
    size_bytes         BIGINT,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT uq_artifact_per_sbom UNIQUE (sbom_document_id, artifact_hash)
);

-- =============================================================
-- TABLE: verification_events
-- Records each verification request against a submitted SBOM.
-- =============================================================
CREATE TABLE verification_events (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sbom_document_id    UUID        NOT NULL REFERENCES sbom_documents(id) ON DELETE CASCADE,
    submitted_hash      CHAR(64)    NOT NULL,
    stored_hash         CHAR(64)    NOT NULL,
    match               BOOLEAN     NOT NULL,
    verified_by         VARCHAR(255),
    verifier_role       VARCHAR(64),
    verification_mode   VARCHAR(32) NOT NULL
                            CHECK (verification_mode IN ('API', 'CLI')),
    fabric_tx_id        VARCHAR(128),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- TABLE: compliance_reports
-- Stores generated compliance report results for SBOM records.
-- =============================================================
CREATE TABLE compliance_reports (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sbom_document_id    UUID        NOT NULL REFERENCES sbom_documents(id) ON DELETE CASCADE,
    integrity_match     BOOLEAN     NOT NULL,
    ledger_status       VARCHAR(32) NOT NULL,
    history_count       INTEGER     NOT NULL DEFAULT 0,
    latest_tx_id        VARCHAR(128),
    latest_timestamp    BIGINT,
    latest_is_delete    BOOLEAN     NOT NULL DEFAULT false,
    compliant           BOOLEAN     NOT NULL,
    generated_by        VARCHAR(255),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- INDEXES — sbom_documents
-- =============================================================
CREATE INDEX idx_sbom_documents_sbom_id       ON sbom_documents(sbom_id);
CREATE INDEX idx_sbom_documents_sbom_hash     ON sbom_documents(sbom_hash);
CREATE INDEX idx_sbom_documents_software_name ON sbom_documents(software_name);
CREATE INDEX idx_sbom_documents_status        ON sbom_documents(status);
CREATE INDEX idx_sbom_documents_created_at    ON sbom_documents(created_at);
CREATE INDEX idx_sbom_documents_sbom_json_gin ON sbom_documents USING GIN (sbom_json);

-- =============================================================
-- INDEXES — artifact_records
-- =============================================================
CREATE INDEX idx_artifact_records_sbom_document_id ON artifact_records(sbom_document_id);
CREATE INDEX idx_artifact_records_artifact_hash    ON artifact_records(artifact_hash);

-- =============================================================
-- INDEXES — verification_events
-- =============================================================
CREATE INDEX idx_verification_events_sbom_document_id ON verification_events(sbom_document_id);

-- =============================================================
-- INDEXES — compliance_reports
-- =============================================================
CREATE INDEX idx_compliance_reports_sbom_document_id ON compliance_reports(sbom_document_id);

-- =============================================================
-- TRIGGER: updated_at auto-update for sbom_documents
-- =============================================================
CREATE OR REPLACE FUNCTION tpsr_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sbom_documents_updated_at
    BEFORE UPDATE ON sbom_documents
    FOR EACH ROW
    EXECUTE FUNCTION tpsr_set_updated_at();
