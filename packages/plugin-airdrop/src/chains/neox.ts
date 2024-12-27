import { Chain } from 'viem';

export const neox: Chain = {
    id: 12227332,
    name: 'NeoX TestNet T4',
    network: 'neox-testnet',
    nativeCurrency: {
        name: 'GAS',
        symbol: 'GAS',
        decimals: 18,
    },
    rpcUrls: {
        default: {
            http: ['https://neoxt4seed1.ngd.network/'],
            webSocket: ['wss://neoxt4wss1.ngd.network'],
        },
        public: {
            http: ['https://neoxt4seed1.ngd.network/'],
            webSocket: ['wss://neoxt4wss1.ngd.network'],
        },
    },
    blockExplorers: {
        default: {
            name: 'NeoX T4 Explorer',
            url: 'https://xt4scan.ngd.network',
        },
    },
    testnet: true,
};