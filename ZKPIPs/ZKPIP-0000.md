# ZKPIP-0000: ZKPIP Process and Specification Template

| Field       | Value                        |
|-------------|------------------------------|
| ZKPIP ID    | 0000                         |
| Title       | ZKPIP Process and Specification Template |
| Status      | Draft                        |
| Category    | Process                      |
| Authors     | zkPIP Contributors           |
| Created     | 2025-08-05                   |

---

## Summary

This document describes the process for creating and evolving ZKPIPs – Zero-Knowledge Proof Improvement Proposals.

## Motivation

To reduce fragmentation and bring consistency to the ZK ecosystem by providing a clear structure for proposals.

## Specification

ZKPIPs must follow the file naming convention:

```
ZKPIP-<ecosystem>-<prooftype>-<NNN>_<snake_case_code>.md
```

Each ZKPIP should include:

- **Title**
- **ZKPIP ID**
- **Status** (`Draft`, `Active`, `Deprecated`, `Rejected`)
- **Category** (`Process`, `Error`, `Ecosystem`, etc.)
- **Created / Last Updated**
- **Authors**
- **Motivation**
- **Specification**
- **Reference Links**
- **Usage/Adoption (optional)**

## Status Lifecycle

| Status     | Description                                                |
|------------|------------------------------------------------------------|
| Draft      | Proposed and under discussion                              |
| Active     | Accepted and used in tooling or documentation              |
| Deprecated | Replaced by a newer ZKPIP                                 |
| Rejected   | Closed without adoption                                    |

## Example

Filename:  
```
ZKPIP-circom-groth16-001_invalid_ic_length.md
```

---

## License

MIT © 2025 zkPIP contributors
