package main

import (
	"log"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func main() {
	chaincode, err := contractapi.NewChaincode(&SBOMContract{})
	if err != nil {
		log.Panicf("Error creating TPSR SBOM chaincode: %v", err)
	}

	if err := chaincode.Start(); err != nil {
		log.Panicf("Error starting TPSR SBOM chaincode: %v", err)
	}
}
