#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { buildVectorsValidateCommand } from "./commands/vectors-validate.js";
import { verifyCommand } from "./commands/verify.js"; // feltételezve, hogy ez szintén CommandModule

yargs(hideBin(process.argv))
  .scriptName("zkpip")
  .command(buildVectorsValidateCommand()) // ← Itt a helyes regisztráció
  .command(verifyCommand)                 // ha ez is CommandModule
  .demandCommand()
  .strict()
  .help()
  .parse();
