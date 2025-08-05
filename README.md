# ZKPIP – Zero-Knowledge Proof Improvement Proposals

This repository defines the **core framework and governance model** for ZKPIP –  
a structured proposal system aimed at standardizing the fragmented zero-knowledge ecosystem.

## Purpose

ZKPIP exists to:

- Define a **shared vocabulary** and **modular classification** system for ZK proofs, error types, tooling, and ecosystems.
- Serve as a **reference foundation** for developer tools and libraries built on top of multiple ZK stacks.
- Provide the canonical format for ZK improvement proposals, used across all downstream repositories.

## Structure

Each ZKPIP document is stored under the `/ZKPIPs/` directory and follows a structured markdown format:  
`ZKPIP-XXXX.md` (e.g., `ZKPIP-0000.md` for this framework).

Associated subprojects (initially private):

- [`zkpip/error-catalog`](https://github.com/zkpip/error-catalog): Reference repository for standardized ZK error codes.
- [`zkpip/zktools`](https://github.com/zkpip/zktools): Command-line and IDE tools that consume ZKPIP-compatible metadata.
- [`zkpip/lab`](https://github.com/zkpip/lab): Internal testbed for crawling, collecting, and validating edge-case ZK failures and patterns.

## License

MIT © 2025 zkPIP contributors