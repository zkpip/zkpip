export function failHardOrSoft(): never {
  if (process.env.ZKPIP_HARD_EXIT === '1') {
    process.exit(1);
  }
  // soft
  process.exitCode = 1;
  throw new Error('Aborted with soft exit (ZKPIP_HARD_EXIT!=1)');
}
