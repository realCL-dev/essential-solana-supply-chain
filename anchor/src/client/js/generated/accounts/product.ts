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
  getArrayDecoder,
  getArrayEncoder,
  getBooleanDecoder,
  getBooleanEncoder,
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
  getU8Decoder,
  getU8Encoder,
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
  getProductStatusDecoder,
  getProductStatusEncoder,
  getStageDecoder,
  getStageEncoder,
  type ProductStatus,
  type ProductStatusArgs,
  type Stage,
  type StageArgs,
} from '../types';

export const PRODUCT_DISCRIMINATOR = new Uint8Array([
  102, 76, 55, 251, 38, 73, 224, 229,
]);

export function getProductDiscriminatorBytes() {
  return fixEncoderSize(getBytesEncoder(), 8).encode(PRODUCT_DISCRIMINATOR);
}

export type Product = {
  discriminator: ReadonlyUint8Array;
  owner: Address;
  serialNumber: string;
  description: string;
  status: ProductStatus;
  createdAt: bigint;
  eventsCounter: bigint;
  stages: Array<Stage>;
  currentStageIndex: number;
  useStages: boolean;
};

export type ProductArgs = {
  owner: Address;
  serialNumber: string;
  description: string;
  status: ProductStatusArgs;
  createdAt: number | bigint;
  eventsCounter: number | bigint;
  stages: Array<StageArgs>;
  currentStageIndex: number;
  useStages: boolean;
};

export function getProductEncoder(): Encoder<ProductArgs> {
  return transformEncoder(
    getStructEncoder([
      ['discriminator', fixEncoderSize(getBytesEncoder(), 8)],
      ['owner', getAddressEncoder()],
      ['serialNumber', addEncoderSizePrefix(getUtf8Encoder(), getU32Encoder())],
      ['description', addEncoderSizePrefix(getUtf8Encoder(), getU32Encoder())],
      ['status', getProductStatusEncoder()],
      ['createdAt', getI64Encoder()],
      ['eventsCounter', getU64Encoder()],
      ['stages', getArrayEncoder(getStageEncoder())],
      ['currentStageIndex', getU8Encoder()],
      ['useStages', getBooleanEncoder()],
    ]),
    (value) => ({ ...value, discriminator: PRODUCT_DISCRIMINATOR })
  );
}

export function getProductDecoder(): Decoder<Product> {
  return getStructDecoder([
    ['discriminator', fixDecoderSize(getBytesDecoder(), 8)],
    ['owner', getAddressDecoder()],
    ['serialNumber', addDecoderSizePrefix(getUtf8Decoder(), getU32Decoder())],
    ['description', addDecoderSizePrefix(getUtf8Decoder(), getU32Decoder())],
    ['status', getProductStatusDecoder()],
    ['createdAt', getI64Decoder()],
    ['eventsCounter', getU64Decoder()],
    ['stages', getArrayDecoder(getStageDecoder())],
    ['currentStageIndex', getU8Decoder()],
    ['useStages', getBooleanDecoder()],
  ]);
}

export function getProductCodec(): Codec<ProductArgs, Product> {
  return combineCodec(getProductEncoder(), getProductDecoder());
}

export function decodeProduct<TAddress extends string = string>(
  encodedAccount: EncodedAccount<TAddress>
): Account<Product, TAddress>;
export function decodeProduct<TAddress extends string = string>(
  encodedAccount: MaybeEncodedAccount<TAddress>
): MaybeAccount<Product, TAddress>;
export function decodeProduct<TAddress extends string = string>(
  encodedAccount: EncodedAccount<TAddress> | MaybeEncodedAccount<TAddress>
): Account<Product, TAddress> | MaybeAccount<Product, TAddress> {
  return decodeAccount(
    encodedAccount as MaybeEncodedAccount<TAddress>,
    getProductDecoder()
  );
}

export async function fetchProduct<TAddress extends string = string>(
  rpc: Parameters<typeof fetchEncodedAccount>[0],
  address: Address<TAddress>,
  config?: FetchAccountConfig
): Promise<Account<Product, TAddress>> {
  const maybeAccount = await fetchMaybeProduct(rpc, address, config);
  assertAccountExists(maybeAccount);
  return maybeAccount;
}

export async function fetchMaybeProduct<TAddress extends string = string>(
  rpc: Parameters<typeof fetchEncodedAccount>[0],
  address: Address<TAddress>,
  config?: FetchAccountConfig
): Promise<MaybeAccount<Product, TAddress>> {
  const maybeAccount = await fetchEncodedAccount(rpc, address, config);
  return decodeProduct(maybeAccount);
}

export async function fetchAllProduct(
  rpc: Parameters<typeof fetchEncodedAccounts>[0],
  addresses: Array<Address>,
  config?: FetchAccountsConfig
): Promise<Account<Product>[]> {
  const maybeAccounts = await fetchAllMaybeProduct(rpc, addresses, config);
  assertAccountsExist(maybeAccounts);
  return maybeAccounts;
}

export async function fetchAllMaybeProduct(
  rpc: Parameters<typeof fetchEncodedAccounts>[0],
  addresses: Array<Address>,
  config?: FetchAccountsConfig
): Promise<MaybeAccount<Product>[]> {
  const maybeAccounts = await fetchEncodedAccounts(rpc, addresses, config);
  return maybeAccounts.map((maybeAccount) => decodeProduct(maybeAccount));
}
