import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dns from 'node:dns';
import { MongoClient } from 'mongodb';

dns.setServers(['8.8.8.8', '8.8.4.4']);

function loadEnvLocal() {
    const envPath = path.resolve(process.cwd(), '.env.local');

    if (!fs.existsSync(envPath)) {
        throw new Error(`Missing .env.local at ${envPath}`);
    }

    for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/u)) {
        const line = rawLine.trim();

        if (!line || line.startsWith('#')) {
            continue;
        }

        const separator = line.indexOf('=');

        if (separator <= 0) {
            continue;
        }

        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();

        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        if (!(key in process.env)) {
            process.env[key] = value;
        }
    }
}

function requireEnv(name) {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new Error(`${name} must be set in .env.local`);
    }

    return value;
}

function jsonReplacer(_key, value) {
    return typeof value === 'bigint' ? value.toString() : value;
}

loadEnvLocal();

const mongoUri = requireEnv('MONGODB_URI');
const databaseName =
    process.env.MONGODB_DB?.trim() ||
    process.env.MONGODB_DB_NAME?.trim() ||
    'metawork_db';

const payoutRoundKey =
    '6a8c74f819e195f35aa601d1:payout-round:v1';

const client = new MongoClient(mongoUri);

try {
    await client.connect();

    const db = client.db(databaseName);

    const payoutRound = await db
        .collection('revenue_payout_rounds')
        .findOne({ payoutRoundKey });

    if (!payoutRound) {
        throw new Error(
            `No revenue_payout_rounds document found for ${payoutRoundKey}`,
        );
    }

    const safeOutput = {
        mode: 'read-only-payout-round-inspection',
        payoutRoundKey: payoutRound.payoutRoundKey ?? null,
        batchId: payoutRound.batchId ?? null,
        batchKey: payoutRound.batchKey ?? null,
        status: payoutRound.status ?? null,
        revenuePoolAppId: payoutRound.revenuePoolAppId ?? null,
        poolKey: payoutRound.poolKey ?? null,
        revenueTokenAssetId: payoutRound.revenueTokenAssetId ?? null,
        usdcAssetId: payoutRound.usdcAssetId ?? null,
        totalUsdcAtomicUnits: payoutRound.totalUsdcAtomicUnits ?? null,
        nextRoundId: payoutRound.nextRoundId ?? null,
        recipientCount: payoutRound.roundPayees?.length ?? null,
        roundPayeesHash: payoutRound.roundPayeesHash ?? null,
        roundPayees: payoutRound.roundPayees ?? [],
        groupId: payoutRound.groupId ?? null,
        unsignedTransactionHash: payoutRound.unsignedTransactionHash ?? null,
        transactionIds: payoutRound.transactionIds ?? null,
        payoutSubmissionAttempt: payoutRound.payoutSubmissionAttempt ?? null,
        submittedAt: payoutRound.submittedAt ?? null,
        confirmedAt: payoutRound.confirmedAt ?? null,
        confirmedRound: payoutRound.confirmedRound ?? null,
        createdAt: payoutRound.createdAt ?? null,
        updatedAt: payoutRound.updatedAt ?? null,
    };

    console.log(JSON.stringify(safeOutput, jsonReplacer, 2));
} finally {
    await client.close();
}