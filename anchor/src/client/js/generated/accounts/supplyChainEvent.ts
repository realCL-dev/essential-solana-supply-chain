/**
 * This code was AUTOGENERATED using the codama library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun codama to update it.
 *
 * @see https://github.com/codama-idl/codama
 */

import {
  addDecoderSizePrefix,
  addEncoderSizePrefix,
  assertAccountExists,
  assertAccountsExist,
  combineCodec,
  decodeAccount,
  fetchEncodedAccount,
  fetchEncodedAccounts,
  fixDecoderSize,
  fixEncoderSize,
  getAddressDecoder,
  getAddressEncoder,
  getBytesDecoder,
  getBytesEncoder,
  getI64Decoder,
  getI64Encoder,
  getStructDecoder,
  getStructEncoder,
  getU32Decoder,
  getU32Encoder,
  getU64Decoder,
  getU64Encoder,
  getUtf8Decoder,
  getUtf8Encoder,
  transformEncoder,
  type Account,
  type Address,
  type Codec,
  type Decoder,
  type EncodedAccount,
  type Encoder,
  type FetchAccountConfig,
  type FetchAccountsConfig,
  type MaybeAccount,
  type MaybeEncodedAccount,
  type ReadonlyUint8Array,
} from 'gill';
import {
  getEventTypeDecoder,
  getEventTypeEncoder,
  type EventType,
  type EventTypeArgs,
} from '../types';

export const SUPPLY_CHAIN_EVENT_DISCRIMINATOR = new Uint8Array([
  211, 55, 255, 36, 84, 248, 218, 52,
]);

export function getSupplyChainEventDiscriminatorBytes() {
  return fixEncoderSize(getBytesEncoder(), 8).encode(
    SUPPLY_CHAIN_EVENT_DISCRIMINATOR
  );
}

export type SupplyChainEvent = {
  discriminator: ReadonlyUint8Array;
  product: Address;
  eventType: EventType;
  description: string;
  stageName: string;
  timestamp: bigint;
  eventIndex: bigint;
};

export type SupplyChainEventArgs = {
  product: Address;
  eventType: EventTypeArgs;
  description: string;
  stageName: string;
  timestamp: number | bigint;
  eventIndex: number | bigint;
};

export function getSupplyChainEventEncoder(): Encoder<SupplyChainEventArgs> {
  return transformEncoder(
    getStructEncoder([
      ['discriminator', fixEncoderSize(getBytesEncoder(), 8)],
      ['product', getAddressEncoder()],
      ['eventType', getEventTypeEncoder()],
      ['description', addEncoderSizePrefix(getUtf8Encoder(), getU32Encoder())],
      ['stageName', addEncoderSizePrefix(getUtf8Encoder(), getU32Encoder())],
      ['timestamp', getI64Encoder()],
      ['eventIndex', getU64Encoder()],
    ]),
    (value) => ({ ...value, discriminator: SUPPLY_CHAIN_EVENT_DISCRIMINATOR })
  );
}

export function getSupplyChainEventDecoder(): Decoder<SupplyChainEvent> {
  return getStructDecoder([
    ['discriminator', fixDecoderSize(getBytesDecoder(), 8)],
    ['product', getAddressDecoder()],
    ['eventType', getEventTypeDecoder()],
    ['description', addDecoderSizePrefix(getUtf8Decoder(), getU32Decoder())],
    ['stageName', addDecoderSizePrefix(getUtf8Decoder(), getU32Decoder())],
    ['timestamp', getI64Decoder()],
    ['eventIndex', getU64Decoder()],
  ]);
}

export function getSupplyChainEventCodec(): Codec<
  SupplyChainEventArgs,
  SupplyChainEvent
> {
  return combineCodec(
    getSupplyChainEventEncoder(),
    getSupplyChainEventDecoder()
  );
}

export function decodeSupplyChainEvent<TAddress extends string = string>(
  encodedAccount: EncodedAccount<TAddress>
): Account<SupplyChainEvent, TAddress>;
export function decodeSupplyChainEvent<TAddress extends string = string>(
  encodedAccount: MaybeEncodedAccount<TAddress>
): MaybeAccount<SupplyChainEvent, TAddress>;
export function decodeSupplyChainEvent<TAddress extends string = string>(
  encodedAccount: EncodedAccount<TAddress> | MaybeEncodedAccount<TAddress>
):
  | Account<SupplyChainEvent, TAddress>
  | MaybeAccount<SupplyChainEvent, TAddress> {
  return decodeAccount(
    encodedAccount as MaybeEncodedAccount<TAddress>,
    getSupplyChainEventDecoder()
  );
}

export async function fetchSupplyChainEvent<TAddress extends string = string>(
  rpc: Parameters<typeof fetchEncodedAccount>[0],
  address: Address<TAddress>,
  config?: FetchAccountConfig
): Promise<Account<SupplyChainEvent, TAddress>> {
  const maybeAccount = await fetchMaybeSupplyChainEvent(rpc, address, config);
  assertAccountExists(maybeAccount);
  return maybeAccount;
}

export async function fetchMaybeSupplyChainEvent<
  TAddress extends string = string,
>(
  rpc: Parameters<typeof fetchEncodedAccount>[0],
  address: Address<TAddress>,
  config?: FetchAccountConfig
): Promise<MaybeAccount<SupplyChainEvent, TAddress>> {
  const maybeAccount = await fetchEncodedAccount(rpc, address, config);
  return decodeSupplyChainEvent(maybeAccount);
}

export async function fetchAllSupplyChainEvent(
  rpc: Parameters<typeof fetchEncodedAccounts>[0],
  addresses: Array<Address>,
  config?: FetchAccountsConfig
): Promise<Account<SupplyChainEvent>[]> {
  const maybeAccounts = await fetchAllMaybeSupplyChainEvent(
    rpc,
    addresses,
    config
  );
  assertAccountsExist(maybeAccounts);
  return maybeAccounts;
}

export async function fetchAllMaybeSupplyChainEvent(
  rpc: Parameters<typeof fetchEncodedAccounts>[0],
  addresses: Array<Address>,
  config?: FetchAccountsConfig
): Promise<MaybeAccount<SupplyChainEvent>[]> {
  const maybeAccounts = await fetchEncodedAccounts(rpc, addresses, config);
  return maybeAccounts.map((maybeAccount) =>
    decodeSupplyChainEvent(maybeAccount)
  );
}
