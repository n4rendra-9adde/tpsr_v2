package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func (c *SBOMContract) VerifyIntegrity(
	ctx contractapi.TransactionContextInterface,
	sbomID string,
	submittedHash string,
) (*VerificationResult, error) {
	if sbomID == "" {
		return nil, fmt.Errorf("sbomID is required")
	}
	if submittedHash == "" {
		return nil, fmt.Errorf("submittedHash is required")
	}

	recordBytes, err := ctx.GetStub().GetState(sbomID)
	if err != nil {
		return nil, fmt.Errorf("failed to read world state: %w", err)
	}
	if recordBytes == nil {
		return nil, fmt.Errorf("SBOM record with ID %q not found", sbomID)
	}

	var record SBOMRecord
	if err := json.Unmarshal(recordBytes, &record); err != nil {
		return nil, fmt.Errorf("failed to unmarshal SBOM record: %w", err)
	}

	match := submittedHash == record.Hash

	result := &VerificationResult{
		SBOMID:        record.SBOMID,
		SubmittedHash: submittedHash,
		StoredHash:    record.Hash,
		Match:         match,
		Status:        record.Status,
	}

	return result, nil
}
