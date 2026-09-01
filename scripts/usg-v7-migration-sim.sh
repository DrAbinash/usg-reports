#!/usr/bin/env bash
# NAS upgrade simulation: build a DB with the OLD v6 schema (accessionNumber
# NOT NULL + UNIQUE), seed real-world rows, then push the NEW v6.1 schema
# exactly as docker-entrypoint.sh does (NO --accept-data-loss) and run the
# v7 backfill. Proves: (1) the push is non-destructive, (2) data survives,
# (3) "" normalises to NULL, (4) multiple NULL accessions coexist.
set -e
cd /home/z/my-project/usg-reports
SIM=/tmp/usg-mig-sim
rm -rf "$SIM" && mkdir -p "$SIM/db"

# 1. OLD schema (from git HEAD) → fresh scratch DB
git show HEAD:prisma/schema.prisma > "$SIM/old-schema.prisma"
DATABASE_URL="file:$SIM/db/old.db" npx prisma db push --schema "$SIM/old-schema.prisma" --skip-generate > /dev/null

# 2. Seed rows the OLD schema allowed (the guard made "" rare, but a
#    backup-restore edge could write it)
DATABASE_URL="file:$SIM/db/old.db" node - << 'EOF'
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
(async () => {
  await db.usgCareOrder.create({ data: { accessionNumber: "CARE-24101", careWorklistId: "4001", patientName: "Legacy Patient", patientSex: "F", status: "PENDING" } });
  await db.usgCareOrder.create({ data: { accessionNumber: "", careWorklistId: "4002", patientName: "Blank Edge", patientSex: "F", status: "PENDING" } });
  await db.usgReport.create({ data: { patientName: "Kept Report", patientSex: "F", studyKey: "ob", serialNo: 1, status: "FINALIZED" } });
  console.log("seeded: 2 orders (1 populated accession, 1 blank) + 1 finalized report");
  await db.$disconnect();
})();
EOF

echo "--- pushing NEW schema (no --accept-data-loss, as the NAS entrypoint does) ---"
DATABASE_URL="file:$SIM/db/old.db" npx prisma db push --skip-generate 2>&1 | tail -2

echo "--- v7 backfill ---"
DATABASE_URL="file:$SIM/db/old.db" node scripts/usg-v7-null-accession.mjs

echo "--- verification ---"
DATABASE_URL="file:$SIM/db/old.db" node - << 'EOF'
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
(async () => {
  const legacy = await db.usgCareOrder.findUnique({ where: { accessionNumber: "CARE-24101" } });
  const blank = await db.usgCareOrder.findFirst({ where: { careWorklistId: "4002" } });
  const report = await db.usgReport.findFirst({ where: { serialNo: 1 } });
  console.log("legacy populated accession kept:", legacy?.accessionNumber === "CARE-24101" && legacy?.patientName === "Legacy Patient");
  console.log("legacy blank normalised to NULL:", blank?.accessionNumber === null);
  console.log("finalized report intact:", report?.patientName === "Kept Report");
  // The new reality: TWO blank-accession orders coexist (NULLs are distinct)
  await db.usgCareOrder.create({ data: { accessionNumber: null, careWorklistId: "4831", patientName: "Sital Jaiswal", patientSex: "F", studyInstanceUid: "1.2.276.0.26.1.1.1.2.2026.280.41706.2166193", status: "PENDING" } });
  await db.usgCareOrder.create({ data: { accessionNumber: null, careWorklistId: "4832", patientName: "Second Blank", patientSex: "F", status: "PENDING" } });
  const nulls = await db.usgCareOrder.count({ where: { accessionNumber: null } });
  console.log("multiple NULL-accession rows coexist:", nulls === 3, `(${nulls} rows)`);
  await db.$disconnect();
})();
EOF
echo "SIMULATION COMPLETE"
