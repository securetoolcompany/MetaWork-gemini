import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parseUnits } from 'viem';

const ids = ['galaxy-usdc-arc', 'galaxy-eurc-arc'];
const ordinaryWallet = '0x1111111111111111111111111111111111111111';

function read(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
}

function extract(source, pattern, name) {
  const match = source.match(pattern);
  assert.ok(match, 'Missing ' + name);
  return match[0];
}

for (const id of ids) {
  const walletPath =
    'components/tokenized-funds/' + id + '/ArcWalletPanel.jsx';
  const pagePath = 'app/tokenized-funds/' + id + '/page.tsx';
  const configPath = 'lib/tokenized-funds/' + id + '/config.ts';

  test(id + ': public config and page availability agree', () => {
    const config = read(configPath);
    const page = read(pagePath);
    const wallet = read(walletPath);

    assert.match(config, /"depositsEnabled":\s*true/);
    assert.match(config, /"redemptionsEnabled":\s*true/);
    assert.ok(page.includes(
      'const publicDepositsEnabled = vault.depositsEnabled;',
    ));
    assert.ok(page.includes(
      'const publicRedemptionsEnabled = vault.redemptionsEnabled;',
    ));
    assert.ok(wallet.includes(
      'const PUBLIC_DEPOSITS_ENABLED = CONFIG.depositsEnabled === true;',
    ));
    assert.ok(wallet.includes(
      'const PUBLIC_REDEMPTIONS_ENABLED = CONFIG.redemptionsEnabled === true;',
    ));
  });

  test(id + ': ordinary wallets are allowed; pause switches are independent', () => {
    const source = read(walletPath);
    const policy = extract(
      source,
      /function writeAllowed\(kind, account\) \{[\s\S]*?\n\}/,
      'write policy',
    );

    function evaluate(deposits, redemptions) {
      return vm.runInNewContext('(' + policy + ')', {
        PUBLIC_DEPOSITS_ENABLED: deposits,
        PUBLIC_REDEMPTIONS_ENABLED: redemptions,
      }, { timeout: 1000 });
    }

    const enabled = evaluate(true, true);
    assert.equal(enabled('deposit', ordinaryWallet), true);
    assert.equal(enabled('redeem', ordinaryWallet), true);
    assert.equal(enabled('deposit', null), false);
    assert.equal(enabled('redeem', null), false);
    assert.equal(enabled('mint', ordinaryWallet), false);

    const depositsPaused = evaluate(false, true);
    assert.equal(depositsPaused('deposit', ordinaryWallet), false);
    assert.equal(depositsPaused('redeem', ordinaryWallet), true);

    const redemptionsPaused = evaluate(true, false);
    assert.equal(redemptionsPaused('deposit', ordinaryWallet), true);
    assert.equal(redemptionsPaused('redeem', ordinaryWallet), false);

    const disabled = evaluate(false, false);
    assert.equal(disabled('deposit', ordinaryWallet), false);
    assert.equal(disabled('redeem', ordinaryWallet), false);
  });

  test(id + ': decimal parsing works without the 1-asset test cap', () => {
    const source = read(walletPath);
    const parser = extract(
      source,
      /function parseDepositAssets\(value\) \{[\s\S]*?\n\}/,
      'amount parser',
    );

    const parse = vm.runInNewContext('(' + parser + ')', {
      parseUnits,
      requireCondition(condition, message) {
        if (!condition) throw new Error(message);
      },
    }, { timeout: 1000 });

    assert.equal(parse('.5'), 500000n);
    assert.equal(parse('0.5'), 500000n);
    assert.equal(parse('2'), 2000000n);
    assert.equal(parse('0.000001'), 1n);

    for (const value of ['0', '-1', '1e3', '0.0000001', '', 'NaN']) {
      assert.throws(() => parse(value));
    }
    assert.throws(() => parse('9'.repeat(80)));
  });

  test(id + ': transaction safeguards and wallet-owned receivers remain', () => {
    const source = read(walletPath);

    for (const marker of [
      'simulateContract',
      'estimateContractGas',
      'async function assertSession()',
      'window.localStorage.setItem(lockKey',
      'protectionAfter >= protectionBefore',
      'mined.input.toLowerCase() === data.toLowerCase()',
      'args: [assets, selectedAccount]',
      'args: [sharesBefore, selectedAccount, selectedAccount]',
      'Approval confirmed. No deposit was sent.',
    ]) {
      assert.ok(source.includes(marker), 'Missing safeguard: ' + marker);
    }

    assert.ok(!source.includes('sameAddress(account, EXPECTED_VAULT_OWNER)'));
    assert.ok(!source.includes('sameAddress(account, CONFIG.administrator)'));
    assert.ok(!source.includes('Operator testing is limited'));
  });
}
