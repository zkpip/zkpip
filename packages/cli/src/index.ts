#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { buildVectorsValidateCommand } from "./commands/vectors-validate.js";
import { verifyCmd } from "./commands/verify.js"; 

yargs(hideBin(process.argv))
  .scriptName("zkpip")
  .command(buildVectorsValidateCommand()) 
  .command(verifyCmd)                 
  .demandCommand()
  .strict()
  .help()
  .locale("en")  
  .parse();
