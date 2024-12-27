import {
    type IAgentRuntime,
    type Memory,
    type State,
    HandlerCallback,
    Action
} from "@elizaos/core";
import { createPublicClient, createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { neox } from '../chains/neox';
import { ERC20_ABI } from '../contracts/erc20';
import { AirdropParams, Transaction } from '../types';

export class AirdropAction {
    private account;
    private walletClient;
    private publicClient;

    constructor(privateKey: `0x${string}`) {
        this.account = privateKeyToAccount(privateKey);
        this.walletClient = createWalletClient({
            account: this.account,
            chain: neox,
            transport: http()
        });
        this.publicClient = createPublicClient({
            chain: neox,
            transport: http()
        });
    }

    async airdrop(params: AirdropParams): Promise<Transaction> {
        try {
            // Get token decimals
            const decimals = await this.publicClient.readContract({
                address: params.tokenAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'decimals',
            });

            // Parse amount with correct decimals
            const amount = parseUnits(params.amount, decimals);

            // Send transaction
            const hash = await this.walletClient.writeContract({
                address: params.tokenAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'transfer',
                args: [params.toAddress as `0x${string}`, amount]
            });

            // Get transaction details
            const transaction = await this.publicClient.getTransaction({ hash });

            return {
                hash,
                from: transaction.from,
                to: transaction.to,
                value: transaction.value,
                chainId: transaction.chainId
            };
        } catch (error) {
            console.error('Airdrop failed:', error);
            throw error;
        }
    }
}

// Action handler
export const airdropAction: Action = {
    name: "AIRDROP_TOKENS",
    similes: ["AIRDROP",
        "DROP_TOKENS",
        "SEND_AIRDROP",
        "AIRDROP_ME",
        "SEND_ME",
        "AIRDROP_AI_NEO",
        "SEND_AI_NEO",
        "GET_AIRDROP"],
    description: "Airdrop ERC20 tokens to a specified address on Neox chain",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback?: HandlerCallback
    ) => {
        try {
            // Extract address from message
            const address = message.content.text.match(/0x[a-fA-F0-9]{40}/)?.[0];
            if (!address) {
                throw new Error("No valid address found in message");
            }

            const privateKey = runtime.getSetting("NEOX_PRIVATE_KEY") as `0x${string}`;
            const tokenAddress = runtime.getSetting("AIRDROP_TOKEN_ADDRESS") as string;
            const airdropAmount = runtime.getSetting("AIRDROP_AMOUNT") as string;

            if (!privateKey || !tokenAddress || !airdropAmount) {
                throw new Error("Missing required settings");
            }

            const action = new AirdropAction(privateKey);

            const params: AirdropParams = {
                toAddress: address,
                tokenAddress: tokenAddress,
                amount: airdropAmount,
                chainId: neox.id
            };

            const result = await action.airdrop(params);

            if (callback) {
                callback({
                    text: `Successfully airdropped ${airdropAmount} tokens to ${address}\nTransaction Hash: ${result.hash}\nView on Explorer: ${neox.blockExplorers.default.url}/tx/${result.hash}`,
                    content: {
                        success: true,
                        hash: result.hash,
                        address: address,
                        amount: airdropAmount
                    }
                });
            }

            return true;
        } catch (error) {
            console.error("Error in airdrop handler:", error.message);
            if (callback) {
                callback({ text: `Error: ${error.message}` });
            }
            return false;
        }
    },
    validate: async (runtime: IAgentRuntime) => {
        const requiredSettings = [
            "NEOX_PRIVATE_KEY",
            "AIRDROP_TOKEN_ADDRESS",
            "AIRDROP_AMOUNT"
        ];

        for (const setting of requiredSettings) {
            if (!runtime.getSetting(setting)) {
                throw new Error(`${setting} not configured`);
            }
        }
        return true;
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Please airdrop AI NEO tokens to 0x742d35Cc6634C0532925a3b844Bc454e4438f44e" }
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll airdrop some AI NEO tokens to your address.",
                    action: "AIRDROP_TOKENS"
                }
            }
        ]
    ]
};