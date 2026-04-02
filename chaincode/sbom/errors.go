package main

import "fmt"

func ErrRequiredField(field string) error {
	return fmt.Errorf("%s is required", field)
}

func ErrInvalidFormat(format string) error {
	return fmt.Errorf("invalid format %q: must be SPDX or CycloneDX", format)
}

func ErrSBOMAlreadyExists(sbomID string) error {
	return fmt.Errorf("SBOM record with ID %q already exists", sbomID)
}

func ErrSBOMNotFound(sbomID string) error {
	return fmt.Errorf("SBOM record with ID %q not found", sbomID)
}

func ErrWorldStateRead(err error) error {
	return fmt.Errorf("failed to read world state: %w", err)
}

func ErrWorldStateWrite(err error) error {
	return fmt.Errorf("failed to put state: %w", err)
}

func ErrClientIdentity(err error) error {
	return fmt.Errorf("failed to get client identity: %w", err)
}

func ErrTransactionTimestamp(err error) error {
	return fmt.Errorf("failed to get transaction timestamp: %w", err)
}

func ErrMarshalSBOMRecord(err error) error {
	return fmt.Errorf("failed to marshal SBOM record: %w", err)
}

func ErrUnmarshalSBOMRecord(err error) error {
	return fmt.Errorf("failed to unmarshal SBOM record: %w", err)
}

func ErrHistoryQuery(sbomID string, err error) error {
	return fmt.Errorf("failed to get history for key %q: %w", sbomID, err)
}

func ErrHistoryIteration(err error) error {
	return fmt.Errorf("failed to iterate history: %w", err)
}
