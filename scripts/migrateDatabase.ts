const { argv, exit } = process;

// migrateDatabase.ts db1.coll1 db2.coll2

if (argv.length !== 3 && argv.length !== 4) {
  console.error(
    '[ERROR] migrateDatabase uses the following command scheme:'
    + '\n  migrateDatabase.ts <sourceDb>.<sourceColl> <destDb>.<destColl> <?transform>'
  );
  exit(1);
}

console.log('[TODO] This script has not been implemented! :(');
