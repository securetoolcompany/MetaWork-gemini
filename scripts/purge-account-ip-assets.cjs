// scripts/purge-account-ip-assets.cjs
//
// Generic, account-scoped IP asset cleanup for metawork_db.
//
// Required:
//   One account locator:
//     --email=<email>
//     --username=<username>
//     --user-id=<user-id>
//     --wallet=<algorand-wallet>
//
// Optional:
//   --keep-id=<ip-asset-id>     Repeat this flag for each IP record to preserve.
//
// Modes:
//   --dry-run                   Read-only; default if no mode is provided.
//   --confirm-delete            Performs deletion, but only when paired with:
//   --i-understand-delete-ip-assets
//
// Examples:
//
//   # Inspect every IP record belonging to an email account.
//   node scripts/purge-account-ip-assets.cjs \
//     --email=novadaoholbrook14@gmail.com \
//     --keep-id=6aa5d61d7ae18b1b7a5c7fa1 \
//     --keep-id=6aa5e5882517e33b3c2227f0 \
//     --keep-id=6aa5ea24fb4aa86f4ff453bf \
//     --dry-run
//
//   # Inspect a wallet-only account by username.
//   node scripts/purge-account-ip-assets.cjs \
//     --username=wallet-br5rldln \
//     --dry-run
//
//   # Inspect a wallet-only account by wallet address.
//   node scripts/purge-account-ip-assets.cjs \
//     --wallet=7IWKOOY22UXFIWDRPAONF7HJC2TPICOPHHG3TUIPPZLJWDKDXQ3K6SOFAM \
//     --dry-run
//
//   # Delete every IP record for vYzion after an approved dry run.
//   node scripts/purge-account-ip-assets.cjs \
//     --email=vyzion82@gmail.com \
//     --confirm-delete \
//     --i-understand-delete-ip-assets
//
// This script:
//   - Loads MONGODB_URI from repository-root .env.local.
//   - Uses Google DNS + IPv4-first for MongoDB Atlas SRV resolution.
//   - Connects only to metawork_db.
//   - Removes only documents in ip_assets belonging to the resolved account.
//   - Does NOT delete users, products, collections, Algorand assets,
//     revenue-pool applications, wallet holdings, or blockchain history.

const dns = require('node:dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config({ path: '.env.local' });

const { MongoClient, ObjectId } = require('mongodb');

const DB_NAME = 'metawork_db';
const IP_COLLECTION = 'ip_assets';
const USERS_COLLECTION = 'users';

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

function getFlagValue(flagName) {
  const prefix = `${flagName}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));

  return argument ? argument.slice(prefix.length).trim() : null;
}

function getRepeatedFlagValues(flagName) {
  const prefix = `${flagName}=`;

  return process.argv
    .filter((value) => value.startsWith(prefix))
    .map((value) => value.slice(prefix.length).trim())
    .filter(Boolean);
}

function hasFlag(flagName) {
  return process.argv.includes(flagName);
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value)))];
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stringify(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeWallet(value) {
  return String(value || '').trim().toUpperCase();
}

function redactMongoUri(uri) {
  try {
    return uri.replace(
      /^(mongodb(?:\+srv)?:\/\/)([^:/@]+)(?::[^@]*)?@/i,
      '$1$2:***@',
    );
  } catch {
    return '[configured]';
  }
}

function userSummary(user) {
  return {
    mongoId: stringify(user._id),
    id: stringify(user.id),
    userId: stringify(user.userId),
    email: user.email ?? null,
    username: user.username ?? null,
    displayName: user.profile?.displayName ?? user.displayName ?? user.name ?? null,
    authMethod: user.authMethod ?? null,
    walletAddress: user.walletAddress ?? null,
    wallets: Array.isArray(user.wallets)
      ? user.wallets.map((wallet) => wallet?.address).filter(Boolean).join(', ')
      : null,
  };
}

function assetSummary(asset) {
  return {
    mongoId: stringify(asset._id),
    id: asset.id ?? null,
    name: asset.name ?? null,
    ownerId: stringify(asset.ownerId),
    owner: stringify(asset.owner),
    ownerWallet: asset.ownerWallet ?? null,
    type: asset.type ?? null,
    status: asset.status ?? null,
    isPublic: asset.isPublic ?? null,
    nftAssetId: asset.nftAssetId ?? null,
    revenuePoolAppId: asset.revenuePoolAppId ?? null,
    revenueTokenAssetId: asset.revenueTokenAssetId ?? null,
    tokenizationCompletedAt: asset.tokenizationCompletedAt ?? null,
    createdAt: asset.createdAt ?? null,
  };
}

function parseTarget() {
  const targets = [
    ['email', getFlagValue('--email')],
    ['username', getFlagValue('--username')],
    ['user-id', getFlagValue('--user-id')],
    ['wallet', getFlagValue('--wallet')],
  ].filter(([, value]) => Boolean(value));

  if (targets.length === 0) {
    fail(
      'Provide exactly one target: --email=<email>, --username=<username>, ' +
        '--user-id=<id>, or --wallet=<algorand-wallet>.',
    );
  }

  if (targets.length > 1) {
    fail(
      'Provide only one target locator per run. Use one of --email, --username, ' +
        '--user-id, or --wallet.',
    );
  }

  const [type, rawValue] = targets[0];

  if (type === 'email') {
    return { type, rawValue, value: normalizeEmail(rawValue) };
  }

  if (type === 'wallet') {
    return { type, rawValue, value: normalizeWallet(rawValue) };
  }

  return { type, rawValue, value: rawValue.trim() };
}

function buildUserLookup(target) {
  switch (target.type) {
    case 'email':
      return {
        email: {
          $regex: new RegExp(`^${escapeRegex(target.value)}$`, 'i'),
        },
      };

    case 'username':
      return {
        username: {
          $regex: new RegExp(`^${escapeRegex(target.value)}$`, 'i'),
        },
      };

    case 'user-id':
      return {
        $or: [
          { _id: target.value },
          { id: target.value },
          { userId: target.value },
          ...(ObjectId.isValid(target.value)
            ? [{ _id: new ObjectId(target.value) }]
            : []),
        ],
      };

    case 'wallet':
      return {
        $or: [
          {
            walletAddress: {
              $regex: new RegExp(`^${escapeRegex(target.value)}$`, 'i'),
            },
          },
          {
            'wallets.address': {
              $regex: new RegExp(`^${escapeRegex(target.value)}$`, 'i'),
            },
          },
        ],
      };

    default:
      fail(`Unsupported target type: ${target.type}`);
  }
}

function assertResolvedUserMatchesTarget(user, target) {
  if (target.type === 'email') {
    if (normalizeEmail(user.email) !== target.value) {
      fail(
        `Safety stop: resolved email "${user.email}" does not match "${target.value}".`,
      );
    }
    return;
  }

  if (target.type === 'username') {
    if (String(user.username || '').toLowerCase() !== target.value.toLowerCase()) {
      fail(
        `Safety stop: resolved username "${user.username}" does not match "${target.value}".`,
      );
    }
    return;
  }

  if (target.type === 'user-id') {
    const userIds = [
      stringify(user._id),
      stringify(user.id),
      stringify(user.userId),
    ].filter(Boolean);

    if (!userIds.includes(target.value)) {
      fail(
        `Safety stop: resolved user does not contain requested ID "${target.value}".`,
      );
    }
    return;
  }

  if (target.type === 'wallet') {
    const walletValues = getUserWallets(user).map(normalizeWallet);

    if (!walletValues.includes(target.value)) {
      fail(
        `Safety stop: resolved user does not contain requested wallet "${target.value}".`,
      );
    }
  }
}

function getUserWallets(user) {
  return unique([
    user.walletAddress,
    user.defaultWallet,
    user.profile?.walletAddress,
    user.wallet?.address,
    ...(Array.isArray(user.wallets)
      ? user.wallets.map((wallet) => wallet?.address)
      : []),
  ]);
}

function buildOwnershipFilter(user) {
  const stringIds = unique([
    user._id,
    user.id,
    user.userId,
  ]);

  const idValues = [
    ...stringIds,
    ...stringIds
      .filter((value) => ObjectId.isValid(value))
      .map((value) => new ObjectId(value)),
  ];

  const wallets = getUserWallets(user);

  const clauses = [];

  if (idValues.length > 0) {
    clauses.push({ ownerId: { $in: idValues } });
    clauses.push({ owner: { $in: idValues } });
    clauses.push({ userId: { $in: idValues } });
  }

  if (wallets.length > 0) {
    const walletRegexes = wallets.map(
      (wallet) => new RegExp(`^${escapeRegex(wallet)}$`, 'i'),
    );

    clauses.push({ ownerWallet: { $in: walletRegexes } });
  }

  if (clauses.length === 0) {
    fail('Resolved user has no usable ID or wallet identity for IP ownership matching.');
  }

  return { $or: clauses };
}

function getMode() {
  const wantsConfirm = hasFlag('--confirm-delete');
  const explicitDryRun = hasFlag('--dry-run');
  const acknowledged = hasFlag('--i-understand-delete-ip-assets');

  if (wantsConfirm && explicitDryRun) {
    fail('Use either --dry-run or --confirm-delete, not both.');
  }

  if (wantsConfirm && !acknowledged) {
    fail(
      'Deletion requires both --confirm-delete and --i-understand-delete-ip-assets.',
    );
  }

  return wantsConfirm ? 'delete' : 'dry-run';
}

async function main() {
  if (!process.env.MONGODB_URI) {
    fail('MONGODB_URI is missing from .env.local.');
  }

  const target = parseTarget();
  const mode = getMode();

  const keepIds = unique(getRepeatedFlagValues('--keep-id'));

  console.log('\n🔧 Account IP asset purge');
  console.log(`   Database: ${DB_NAME}`);
  console.log(`   Target: ${target.type}=${target.rawValue}`);
  console.log(`   Mode: ${mode === 'delete' ? 'DELETE — destructive' : 'DRY RUN — no writes'}`);
  console.log(`   Keep IDs: ${keepIds.length ? keepIds.join(', ') : '(none; delete all account IP assets)'}`);
  console.log('   DNS: Google DNS (8.8.8.8, 8.8.4.4), IPv4-first');
  console.log(`   MongoDB URI: ${redactMongoUri(process.env.MONGODB_URI)}\n`);

  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();

    const db = client.db(DB_NAME);
    const users = db.collection(USERS_COLLECTION);
    const ipAssets = db.collection(IP_COLLECTION);

    const user = await users.findOne(buildUserLookup(target));

    if (!user) {
      fail(
        `No user found for ${target.type} "${target.rawValue}". No IP assets were touched.`,
      );
    }

    assertResolvedUserMatchesTarget(user, target);

    console.log('✅ Resolved target user:');
    console.table([userSummary(user)]);

    const ownershipFilter = buildOwnershipFilter(user);

    const accountAssets = await ipAssets
      .find(
        ownershipFilter,
        {
          projection: {
            _id: 1,
            id: 1,
            name: 1,
            ownerId: 1,
            owner: 1,
            userId: 1,
            ownerWallet: 1,
            type: 1,
            status: 1,
            isPublic: 1,
            nftAssetId: 1,
            revenuePoolAppId: 1,
            revenueTokenAssetId: 1,
            tokenizationCompletedAt: 1,
            createdAt: 1,
          },
        },
      )
      .sort({ createdAt: 1, _id: 1 })
      .toArray();

    console.log(
      `\n📦 All IP records found for resolved account: ${accountAssets.length}`,
    );
    console.table(accountAssets.map(assetSummary));

    const keepers = accountAssets.filter((asset) => keepIds.includes(asset.id));
    const missingKeepIds = keepIds.filter(
      (id) => !accountAssets.some((asset) => asset.id === id),
    );

    if (missingKeepIds.length > 0) {
      fail(
        `Safety stop: configured --keep-id value(s) were not found on this account: ` +
          `${missingKeepIds.join(', ')}`,
      );
    }

    console.log(
      `\n✅ Keeper records (${keepers.length}) — these will remain:`,
    );
    console.table(keepers.map(assetSummary));

    const candidates = accountAssets.filter((asset) => !keepIds.includes(asset.id));

    console.log(
      `\n🗑️ IP records selected for deletion from this account only: ${candidates.length}`,
    );
    console.table(candidates.map(assetSummary));

    if (accountAssets.length === 0) {
      console.log('\n✅ No IP records found. Nothing to delete.');
      return;
    }

    if (candidates.length === 0) {
      console.log('\n✅ No deletion candidates. All account IP records are configured keepers.');
      return;
    }

    const candidateIds = candidates.map((asset) => asset._id);

    if (mode === 'dry-run') {
      console.log('\n✅ Dry run complete. No documents were deleted.');

      console.log('\nTo delete this exact account selection, rerun with:');

      const targetFlag = `--${target.type}=${target.rawValue}`;
      const keepFlags = keepIds.map((id) => `--keep-id=${id}`).join(' ');

      console.log(
        `node scripts/purge-account-ip-assets.cjs ${targetFlag} ` +
          `${keepFlags} --confirm-delete --i-understand-delete-ip-assets`
            .replace(/\s+/g, ' ')
            .trim(),
      );

      return;
    }

    console.log(
      `\n⚠️ Deleting ${candidateIds.length} IP document(s) from ${DB_NAME}.${IP_COLLECTION}...`,
    );

    const deletion = await ipAssets.deleteMany({
      _id: { $in: candidateIds },
    });

    if (deletion.deletedCount !== candidateIds.length) {
      fail(
        `Delete-count mismatch: expected ${candidateIds.length}, deleted ${deletion.deletedCount}. ` +
          'Stop and inspect the database.',
      );
    }

    console.log(`✅ Deleted ${deletion.deletedCount} IP asset document(s).`);

    const remaining = await ipAssets
      .find(
        ownershipFilter,
        {
          projection: {
            _id: 1,
            id: 1,
            name: 1,
            ownerId: 1,
            owner: 1,
            userId: 1,
            ownerWallet: 1,
            type: 1,
            status: 1,
            isPublic: 1,
            nftAssetId: 1,
            revenuePoolAppId: 1,
            revenueTokenAssetId: 1,
            tokenizationCompletedAt: 1,
            createdAt: 1,
          },
        },
      )
      .sort({ createdAt: 1, _id: 1 })
      .toArray();

    console.log(`\n📦 Remaining IP records for resolved account: ${remaining.length}`);
    console.table(remaining.map(assetSummary));

    if (remaining.length !== keepIds.length) {
      fail(
        `Post-delete safety check failed: expected ${keepIds.length} remaining IP record(s), ` +
          `but found ${remaining.length}.`,
      );
    }

    const remainingIds = new Set(remaining.map((asset) => asset.id));
    const missingRemainingKeepIds = keepIds.filter((id) => !remainingIds.has(id));

    if (missingRemainingKeepIds.length > 0) {
      fail(
        `Post-delete safety check failed: keeper ID(s) missing: ` +
          `${missingRemainingKeepIds.join(', ')}`,
      );
    }

    const unexpectedRemaining = remaining.filter(
      (asset) => !keepIds.includes(asset.id),
    );

    if (unexpectedRemaining.length > 0) {
      fail(
        'Post-delete safety check failed: one or more unapproved IP records remain.',
      );
    }

    if (keepIds.length === 0) {
      console.log('\n🎉 Cleanup complete. This account now has zero IP asset documents.');
    } else {
      console.log(
        `\n🎉 Cleanup complete. This account now has exactly ${keepIds.length} approved keeper IP record(s).`,
      );
    }
  } catch (error) {
    console.error('\n❌ Account IP purge failed:', error.message || error);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main();