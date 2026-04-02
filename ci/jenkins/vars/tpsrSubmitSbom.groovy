import groovy.json.JsonOutput
import groovy.json.JsonSlurperClassic

def call(Map config = [:]) {
    def requiredKeys = [
        'apiBaseUrl', 'userId', 'role', 'sbomID', 'sbomFile', 
        'buildID', 'softwareName', 'softwareVersion', 'format', 
        'offChainRef', 'signatures'
    ]
    
    for (String key : requiredKeys) {
        if (!config.containsKey(key)) {
            error("TPSR missing required config key: ${key}")
        }
    }

    def stringKeys = [
        'apiBaseUrl', 'userId', 'role', 'sbomID', 'sbomFile', 
        'buildID', 'softwareName', 'softwareVersion', 'format', 'offChainRef'
    ]
    
    for (String key : stringKeys) {
        if (config[key] == null || config[key].toString().trim().isEmpty()) {
            error("TPSR config key cannot be empty: ${key}")
        }
    }

    def sigs = config.signatures
    if (!(sigs instanceof List) || ((List)sigs).isEmpty()) {
        error("TPSR signatures must be a non-empty List")
    }
    for (def sig : (List)sigs) {
        if (!(sig instanceof String) || ((String)sig).trim().isEmpty()) {
            error("TPSR signatures must contain only non-empty String values")
        }
    }

    def formatStr = config.format.toString().trim()
    if (formatStr != 'SPDX' && formatStr != 'CycloneDX') {
        error("TPSR invalid format: ${formatStr}. Must be SPDX or CycloneDX")
    }

    def roleStr = config.role.toString().trim()
    def allowedRoles = ['developer', 'security', 'auditor', 'admin']
    if (!allowedRoles.contains(roleStr)) {
        error("TPSR invalid role: ${roleStr}. Must be one of ${allowedRoles.join(', ')}")
    }

    def sbomFilePath = config.sbomFile.toString().trim()
    if (!fileExists(sbomFilePath)) {
        error("SBOM file not found: ${sbomFilePath}")
    }
    def sbomContent = readFile(file: sbomFilePath).trim()
    if (sbomContent.isEmpty()) {
        error("SBOM file is empty: ${sbomFilePath}")
    }

    def baseUrl = config.apiBaseUrl.toString().trim()
    if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.substring(0, baseUrl.length() - 1)
    }
    def submitUrl = "${baseUrl}/submit"

    def payloadMap = [
        sbomID: config.sbomID.toString().trim(),
        sbom: sbomContent,
        buildID: config.buildID.toString().trim(),
        softwareName: config.softwareName.toString().trim(),
        softwareVersion: config.softwareVersion.toString().trim(),
        format: formatStr,
        offChainRef: config.offChainRef.toString().trim(),
        signatures: ((List)sigs).collect { it.toString().trim() }
    ]
    
    def payloadJson = JsonOutput.toJson(payloadMap)
    
    def uuid = java.util.UUID.randomUUID().toString()
    def payloadFile = "tpsr_payload_${uuid}.json"
    def responseFile = "tpsr_response_${uuid}.json"
    def statusFile = "tpsr_status_${uuid}.txt"

    writeFile(file: payloadFile, text: payloadJson)

    echo "TPSR: Submitting SBOM ${payloadMap.sbomID} (Format: ${formatStr}) to ${submitUrl}"
    echo "TPSR: Build ID: ${payloadMap.buildID}, Software: ${payloadMap.softwareName}"
    
    def curlCmd = """
        curl -s -w "%{http_code}" -X POST \\
        -H "Content-Type: application/json" \\
        -H "x-user-id: ${config.userId.toString().trim()}" \\
        -H "x-user-role: ${roleStr}" \\
        -d @${payloadFile} \\
        -o ${responseFile} \\
        "${submitUrl}" > ${statusFile}
    """
    
    sh(script: curlCmd)
    
    def statusCodeStr = readFile(file: statusFile).trim()
    def responseBody = ""
    if (fileExists(responseFile)) {
        responseBody = readFile(file: responseFile).trim()
    }
    
    sh(script: "rm -f ${payloadFile} ${responseFile} ${statusFile}")

    def statusCode = 0
    try {
        statusCode = statusCodeStr.toInteger()
    } catch (Exception e) {
        error("TPSR submission failed with HTTP parse error from status file")
    }
    
    def slurper = new JsonSlurperClassic()

    if (statusCode == 201) {
        try {
            def parsed = slurper.parseText(responseBody)
            echo "TPSR: Successfully submitted SBOM. Hash: ${parsed.hash}"
            return parsed
        } catch (Exception e) {
            error("TPSR submission returned invalid JSON")
        }
    } else {
        try {
            def parsed = slurper.parseText(responseBody)
            if (parsed.error && parsed.details) {
                error("TPSR submission failed: ${parsed.error} - ${parsed.details}")
            } else if (parsed.error) {
                error("TPSR submission failed: ${parsed.error}")
            } else {
                error("TPSR submission failed with HTTP ${statusCode}")
            }
        } catch (Exception e) {
            error("TPSR submission failed with HTTP ${statusCode}")
        }
    }
}
