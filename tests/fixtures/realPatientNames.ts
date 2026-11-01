/**
 * Names of people who exist.
 *
 * This clinic's fixtures were once copied out of a live database, so the tests,
 * the print goldens and the seeded study normals carried real patients and real
 * referring doctors — pushed to GitHub, rendered onto letterhead in the golden
 * baselines, and printed in one test's expected filename. They have been
 * replaced with synthetic labels (Sample Patientone, Twin Patientnine…), and
 * this list is what stops the old ones from coming back: `tests/fixtureHygiene`
 * fails if any of these appear anywhere in the shipped tree.
 *
 * Two rules for editing this list:
 *  - Add a name here when a real one is found and swept out, never remove one.
 *  - A test fixture must be invented while writing it. Never paste a row.
 */
export const REAL_PATIENT_NAMES = [
  "GUNJAN",
  "PANDEY",
  "FARIDA",
  "KHATOON",
  "RAJESH",
  "GAUTAM",
  "JALDHAR",
  "PARO",
  "PIYUSH",
  "ABU",
  "SHAMA",
  "SATRUGHAN",
  "RUBY",
  "BODEHI",
  "SWETA",
  "SAHAY",
  "ASHA",
  "SHARDHA",
  "TINU",
  "JAIN",
  "ANSARI",
  "ANIL KUMAR",
  "RAMAN KUMAR",
  "NEHA PRIYA",
  "SADHANA",
  "SANJAY KUMAR",
  "KUNDA",
] as const;
