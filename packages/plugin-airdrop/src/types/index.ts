import { type Address, type Hash } from 'viem';

export interface Transaction {
    hash: Hash;
    from: Address;
    to: Address;
    value: bigint;
    chainId?: number;
}

export interface AirdropParams {
    toAddress: string;
    tokenAddress: string; // ERC20 token contract address
    amount: string;
    chainId: number;
}