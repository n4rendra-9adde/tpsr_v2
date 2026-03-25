# TPSR Project Context — Read This First
## Project
Tamper-Proof SBOM Registry — Blockchain-Based SBOM Integrity System
## Background Document
Full requirements and system design are in the uploaded file TPSR_Requirements_SystemDesign.docx
## Implementation Progress
### COMPLETED STEPS
Step 1.1 — Folder structure created and verified
Step 1.2 — go.mod initialized with module github.com/tpsr/chaincode/sbom, Go 1.22, fabric-contract-api-go v1.2.1, fabric-chaincode-go v0.6.0
Step 1.3 — Initialize Node.js API package.json
Step 1.4 — Initialize React dashboard package.json
Step 2.1 — Create crypto-config.yaml
Step 2.2 — Create configtx.yaml
### CURRENT STEP
Step 2.3 — Create docker-compose.yaml
### PENDING STEPS
Step 2.4 — Generate certificates
Step 2.5 — Start network and verify
Step 2.6 — Create channel and verify
Step 3.1 — Define chaincode data structures
Step 3.2 — Write SubmitSBOM function
Step 3.3 — Write VerifyIntegrity function
Step 3.4 — Write GetHistory function
Step 3.5 — Write error handling
Step 3.6 — Write unit tests
Step 3.7 — Deploy and test chaincode
Step 4.1 — Setup Express server
Step 4.2 — Setup Fabric SDK connection
Step 4.3 — Write canonicalization module
Step 4.4 — Write SHA-256 hashing module
Step 4.5 — Write submit endpoint
Step 4.6 — Write verify endpoint
Step 4.7 — Write history endpoint
Step 4.8 — Write compliance report endpoint
Step 4.9 — Write authentication middleware
Step 4.10 — Test all endpoints
Step 5.1 — Setup React project
Step 5.2 — Build SBOM list component
Step 5.3 — Build verification component
Step 5.4 — Build history component
Step 5.5 — Build compliance report component
Step 5.6 — Connect components to REST API
Step 6.1 — Write Jenkins plugin
Step 6.2 — Write GitLab CI plugin
Step 6.3 — Write verification CLI
Step 7.1 — Functional testing
Step 7.2 — Performance testing
Step 7.3 — Security testing
Step 7.4 — Tamper detection validation
## Key Architecture Decisions
Blockchain — Hyperledger Fabric 2.5 with Raft consensus
Organizations — Vendor, Security Team, Auditor
Chaincode language — Go
State database — CouchDB
Consensus — Raft CFT sufficient for permissioned network
Off-chain storage — IPFS for raw SBOM files, PostgreSQL for parsed metadata
XML handling — Convert XML to JSON before canonicalization
Multi-signature — Two stage pipeline, developer automated, security team manual approval gate
Verification modes — API mode and direct Fabric CLI mode for true zero-trust
Channel vs PDC — Single channel now, PDC-compatible design for future
## Data Structure — SBOM Record on Blockchain
sbomID — unique ID combining software name and build number
hash — SHA-256 hash of canonicalized SBOM
timestamp — Unix timestamp of submission
submitterID — X.509 identity of submitter
buildID — CI/CD build number
softwareName — name of software product
softwareVersion — version of software product
format — SPDX or CycloneDX
status — PENDING, APPROVED, ACTIVE, or SUPERSEDED
offChainRef — IPFS CID or PostgreSQL reference
signatures — array of cryptographic signatures
## Technology Versions
Hyperledger Fabric — 2.5.0
Go — 1.22.2
Node.js — 18.x
React — 18.x
Docker — 29.3.0
Ubuntu — 22.04 LTS
fabric-contract-api-go — v1.2.1
fabric-chaincode-go — v0.6.0
fabric-network npm — 2.2.20
## Important Rules
Never move to next step without approval
Always read this file at start of every session
Update COMPLETED STEPS and CURRENT STEP after every approved step
Never hallucinate function names or API calls
Always refer to the uploaded requirements document for specifications
