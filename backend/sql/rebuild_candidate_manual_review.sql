/*
    MANUAL REVIEW HELPER

    DO NOT paste the generated schema here.

    After running:
      .\scripts\run-clean-rebuild-preparation.ps1

    inspect:
      backend\sql\generated\current-schema-rebuild-candidate.sql

    Before execution in any database, verify:
      - only expected CREATE TABLE / CREATE INDEX / ALTER TABLE FK operations;
      - no DROP/TRUNCATE/DELETE/UPDATE/RESTORE;
      - expected model tables are present;
      - this generated Prisma SQL will NOT recreate custom triggers/views.

    The next safe execution target should be a NEW temporary database,
    not the current yacinedb.
*/

SELECT
    @@SERVERNAME AS CurrentServer,
    DB_NAME() AS CurrentDatabase,
    SUSER_SNAME() AS LoginName;
