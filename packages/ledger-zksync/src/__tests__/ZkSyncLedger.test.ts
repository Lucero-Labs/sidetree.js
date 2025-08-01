/*
 * Copyright 2021 - Transmute Industries Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ZksyncLedger } from '..';
import { web3 } from './web3';
import { anchorString, anchorString2, anchorString3 } from './__fixtures__';
import { Wallet } from 'zksync-web3';
import * as dotenv from 'dotenv';
dotenv.config();

jest.setTimeout(10 * 1000);

describe('EthereumLedger', () => {
  const wallet = new Wallet(process.env.PRIVATE_KEY!, web3);
  const ledger = new ZksyncLedger(wallet);
  let blockTimeHash1: string;

  it('First account has enough ether to run the other tests', async () => {
    const account = await wallet.getAddress();
    const balance = await wallet.getBalance();
    expect(account).not.toBeNull();
    expect(balance.toNumber()).toBeGreaterThan(1);
  });

  it('constructs', async () => {
    expect(ledger.approximateTime).toEqual({ time: 0, hash: '' });
  });

  it('gets service version', async () => {
    const serviceVersion = await ledger.getServiceVersion();
    expect(serviceVersion).toBeDefined();
    expect(serviceVersion.name).toBe('zksync');
    expect(serviceVersion.version).toBeDefined();
  });

  it('reads first transaction that got written', async () => {
    const realTime = await ledger.getLatestTime();
    const cachedTime = await ledger.approximateTime;
    expect(realTime.time).toBeDefined();
    expect(realTime.hash).toBeDefined();
    expect(cachedTime.time).toBe(realTime.time);
    expect(cachedTime.hash).toBe(realTime.hash);
    expect(ledger.contractAddress).toBeUndefined();
    const data = anchorString;
    await ledger.initialize();
    await ledger.write(data);
    const realTime2 = await ledger.getLatestTime();
    const cachedTime2 = await ledger.approximateTime;
    blockTimeHash1 = realTime2.hash;
    expect(realTime2.time).toBeDefined();
    expect(realTime2.hash).toBeDefined();
    expect(cachedTime2.time).toBe(realTime2.time);
    expect(cachedTime2.hash).toBe(realTime2.hash);
    expect(ledger.contractAddress).toBeDefined();
    const { moreTransactions, transactions } = await ledger.read(
      0,
      blockTimeHash1
    );
    expect(moreTransactions).toBeFalsy();
    console.log(transactions, moreTransactions);

    // expect(transactions).toHaveLength(1);
    const [transaction] = transactions;
    expect(transaction).toEqual({
      anchorString,
      normalizedTransactionFee: 0,
      transactionFeePaid: 0,
      transactionNumber: 0,
      transactionTime: transaction.transactionTime,
      transactionTimeHash: transaction.transactionTimeHash,
      writer: '0x44A5473dC7951418287835279cbc85ee7CA76D69',
    });
  });

  it('reads next transaction that got written', async () => {
    await ledger.write(anchorString2);
    const realTime = await ledger.getLatestTime();
    const { moreTransactions, transactions } = await ledger.read(
      1,
      realTime.hash
    );
    expect(moreTransactions).toBeFalsy();
    expect(transactions).toHaveLength(1);
    const [t1] = transactions;
    expect(t1).toEqual({
      anchorString: anchorString2,
      normalizedTransactionFee: 0,
      transactionFeePaid: 0,
      transactionNumber: 1,
      transactionTime: t1.transactionTime,
      transactionTimeHash: t1.transactionTimeHash,
      writer: '0x44A5473dC7951418287835279cbc85ee7CA76D69',
    });
  });

  it('reads another transaction that got written', async () => {
    await ledger.write(anchorString3);
    const realTime = await ledger.getLatestTime();
    const { moreTransactions, transactions } = await ledger.read(
      2,
      realTime.hash
    );
    expect(moreTransactions).toBeFalsy();
    expect(transactions).toHaveLength(1);
    const [t1] = transactions;
    expect(t1).toEqual({
      anchorString: anchorString3,
      normalizedTransactionFee: 0,
      transactionFeePaid: 0,
      transactionNumber: 2,
      transactionTime: t1.transactionTime,
      transactionTimeHash: t1.transactionTimeHash,
      writer: '0x44A5473dC7951418287835279cbc85ee7CA76D69',
    });
  });

  it('should return no transaction if the requested transactionNumber has not been reached', async () => {
    const readResult = await ledger.read(
      Number.MAX_SAFE_INTEGER - 1,
      blockTimeHash1
    );
    expect(readResult.moreTransactions).toBeFalsy();
    expect(readResult.transactions).toHaveLength(0);
  });
  it('should return no transaction if the requested transactionTimeHash doesnt exist', async () => {
    const readResult = await ledger.read(undefined, '0x123');
    expect(readResult.moreTransactions).toBeFalsy();
    expect(readResult.transactions).toHaveLength(0);
  });
});
