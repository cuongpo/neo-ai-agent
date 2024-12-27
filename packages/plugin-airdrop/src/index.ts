import { Plugin } from "@elizaos/core";
import { airdropAction } from "./actions/airdrop";

const airdropPlugin: Plugin = {
    name: "airdrop",
    description: "Airdrop ERC20 tokens on Neox chain",
    actions: [airdropAction],
    evaluators: [],
    providers: [],
};

export default airdropPlugin;
export * from "./types";
export * from "./chains/neox";