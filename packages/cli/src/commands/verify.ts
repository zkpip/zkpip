import type { ArgumentsCamelCase } from "yargs";

export const verifyCommand = {
  command: "verify",
  describe: "Verify a proof bundle or a verification JSON input",
  builder: (y: any) =>
    y
      .option("bundle", { type: "string", desc: "Path to proof-bundle JSON" })
      .option("verification", { type: "string", desc: "Path to verification JSON" })
      .option("json", { type: "boolean", default: false })
      .option("exit-codes", { type: "boolean", default: false }),
  handler: async (argv: ArgumentsCamelCase) => {
    // TODO: bekötés @zkpip/core publikus API-ira
    console.log("TODO: implement verify. Args:", {
      bundle: argv.bundle,
      verification: argv.verification,
      json: argv.json,
      exitCodes: argv["exit-codes"]
    });
  }
};
