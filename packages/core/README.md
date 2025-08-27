# @zkpip/core

**ZKPIP Core** --- off-chain verifier toolkit for zero-knowledge
proofs.\
Provides a CLI with multiple adapters and a local "verified" badge
generator.

------------------------------------------------------------------------

## Features

-   Validate proof-bundles against canonical JSON Schemas
-   Verify proofs with adapters:
    -   [`snarkjs`](https://github.com/iden3/snarkjs)
    -   [`rapidsnark`](https://github.com/iden3/rapidsnark)
    -   [`gnark`](https://github.com/ConsenSys/gnark)
-   Generate an offline SVG "verified" badge

------------------------------------------------------------------------

## Quickstart

Install:

``` bash
npm install -g @zkpip/core
```

Validate a proof-bundle:

``` bash
zkpip validate ./vectors/proof-bundle.json
```

Verify with an adapter:

``` bash
zkpip verify --adapter snarkjs --bundle ./vectors/proof-bundle.json
```

Generate a badge:

``` bash
zkpip badge --out ./badge.svg
```

------------------------------------------------------------------------

## Project

-   **Homepage:** [zkpip.org](https://zkpip.org)\
-   **Repository:**
    [github.com/zkpip/zkpip](https://github.com/zkpip/zkpip)\
-   **License:** Apache-2.0
-   **Author:** Tony Nagy - https://tonynagy.io

------------------------------------------------------------------------

## Status

This is the **first 0.1 release** of `@zkpip/core`.\
Interfaces may change until version 1.0.
