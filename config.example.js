module.exports = {
    port: 3000,
    publicRpcs: {
        eth: 'https://rpc.ankr.com/eth',
        bsc: 'https://rpc.ankr.com/bsc',
        polygon: 'https://rpc.ankr.com/polygon',
        avalanche: 'https://rpc.ankr.com/avalanche',
        fantom: 'https://rpc.ankr.com/fantom',
        optimism: 'https://rpc.ankr.com/optimism',
        arbitrum: 'https://rpc.ankr.com/arbitrum'
    },
    rpcs: {
        eth: 'https://ethereum.blockpi.network/v1/rpc/',
        bsc: 'https://bsc.blockpi.network/v1/rpc/',
        polygon: 'https://polygon.blockpi.network/v1/rpc/',
        avalanche: 'https://avalanche.blockpi.network/v1/rpc/',
        fantom: 'https://fantom.blockpi.network/v1/rpc/',
        optimism: 'https://optimism.blockpi.network/v1/rpc/',
        arbitrum: 'https://arbitrum.blockpi.network/v1/rpc/'
    },
    port: 3000,
    privateKey: '',
    FXSWAP_ADDRESS: '0xcA3cE6bf0CB2bbaC5dF3874232AE3F5b67C6b146',
    uniswapV2Handler_ADDRESS: '0x9cBbA6CDA09C7dadA8343C4076c21eE06CCa4836',
    uniswapV3Handler_ADDRESS: '0xbA3981771AB991960028B2F83ae83664Fd003F61',
    aaveV2Handler_ADDRESS: '0xF39FEF928BECF01F045FD609eb44C838ea37325b',
    dodoHandler_ADDRESS: '0x4635a010Be2707a3FB9c3467Fc615202468BC51E',
    compoundHandler_ADDRESS: '',
    cryptocompare_apikey: '',
    '0x_apikeys': [],
    '0x_Proxy_Addresses': {
        eth: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
        polygon: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
        bsc: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
        optimism: '0xdef1abe32c034e558cdd535791643c58a13acc10',
        fantom: '0xdef189deaef76e379df891899eb5a00a94cbc250',
        avalanche: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
        arbitrum: '0xdef1c0ded9bec7f1a1670819833240f027b25eff'
    },
    tokenList: {
        eth: {
            tokenList_urls: ['https://gateway.ipfs.io/ipns/tokens.uniswap.org','https://gateway.ipfs.io/ipns/extendedtokens.uniswap.org'],
            logo_url:
                'https://file.fxwallet.com/token/49b2544d7b7a10418b5851aab81e0c1bc48e4138a4f3707bb4f3ea1a8cf26ec6.svg',
            recommend: ['ETH', 'WETH', 'USDT', 'USDC', 'DAI', 'WBTC']
        },
        goerli: {
            tokenList_url: 'https://file.test.fxwallet.com/other/g.json',
            logo_url:
                'https://file.fxwallet.com/token/49b2544d7b7a10418b5851aab81e0c1bc48e4138a4f3707bb4f3ea1a8cf26ec6.svg',
            recommend: []
        },
        bsc: {
            tokenList_urls: ['https://gateway.ipfs.io/ipns/tokens.uniswap.org','https://gateway.ipfs.io/ipns/extendedtokens.uniswap.org'],
            logo_url:
                'https://file.fxwallet.com/token/62ad22a04becfde983e3c940113d356e84691c80a882d304840c8162cc8fc394.svg',
            recommend: ['BNB', 'WBNB', 'WETH', 'USDT', 'USDC', 'DAI', 'WBTC']
        },
        polygon: {
            tokenList_urls: ['https://gateway.ipfs.io/ipns/tokens.uniswap.org','https://gateway.ipfs.io/ipns/extendedtokens.uniswap.org'],
            logo_url:
                'https://file.fxwallet.com/token/34ee6b70c50f3f2556796b3c79d3f76cc05c89ecec1bb5b12a6d6cbfae23e058.png',
            recommend: ['MATIC', 'WMATIC', 'WETH', 'USDT', 'USDC', 'DAI', 'WBTC']
        },
        avalanche: {
            tokenList_urls: ['https://gateway.ipfs.io/ipns/tokens.uniswap.org','https://gateway.ipfs.io/ipns/extendedtokens.uniswap.org'],
            logo_url: 'https://file.fxwallet.com/1679972090672-avax.png',
            recommend: ['AVAX', 'WAVAX', 'WETH', 'USDT', 'USDC', 'DAI', 'WBTC']
        },
        fantom: {
            tokenList_urls: ['https://raw.githubusercontent.com/SpookySwap/spooky-info/master/src/constants/token/spookyswap.json'],
            logo_url: 'https://file.fxwallet.com/default/1683530682226-ftm.png',
            recommend: ['FTM', 'WFTM', 'WETH', 'USDT', 'USDC', 'DAI', 'WBTC']
        },
        optimism: {
            tokenList_urls: ['https://gateway.ipfs.io/ipns/tokens.uniswap.org','https://gateway.ipfs.io/ipns/extendedtokens.uniswap.org'],
            logo_url:
                'https://file.fxwallet.com/token/2a53bc62dff62b5ee60e2297032990fc9bddf3b80c30e0a3ea8945d447a71cba.svg',
            recommend: ['OP', 'WETH', 'USDT', 'USDC', 'DAI', 'WBTC']
        },
        arbitrum: {
            tokenList_urls: ['https://gateway.ipfs.io/ipns/tokens.uniswap.org','https://gateway.ipfs.io/ipns/extendedtokens.uniswap.org'],
            logo_url:
                'https://file.fxwallet.com/token/cea438da55ced2ac65bea8d4aab84a3b53d723da7c0feed25446f9879ce1433e.svg',
            recommend: ['WETH', 'USDT', 'USDC', 'DAI', 'WBTC']
        }
    },
    allTokens: {
        eth: {
            tokenList_urls: ['https://tokens.coingecko.com/ethereum/all.json'],
            logo_url:
                'https://file.fxwallet.com/token/49b2544d7b7a10418b5851aab81e0c1bc48e4138a4f3707bb4f3ea1a8cf26ec6.svg',
            recommend: ['ETH', 'WETH', 'USDT', 'USDC', 'DAI', 'WBTC']
        },
        goerli: {
            tokenList_urls: ['https://file.test.fxwallet.com/other/g.json'],
            logo_url:
                'https://file.fxwallet.com/token/49b2544d7b7a10418b5851aab81e0c1bc48e4138a4f3707bb4f3ea1a8cf26ec6.svg',
            recommend: []
        },
        bsc: {
            tokenList_urls: ['https://tokens.coingecko.com/binance-smart-chain/all.json'],
            logo_url:
                'https://file.fxwallet.com/token/62ad22a04becfde983e3c940113d356e84691c80a882d304840c8162cc8fc394.svg',
            recommend: ['BNB', 'WBNB', 'WETH', 'USDT', 'USDC', 'DAI', 'WBTC']
        },
        polygon: {
            tokenList_urls: ['https://tokens.coingecko.com/polygon-pos/all.json'],
            logo_url:
                'https://file.fxwallet.com/token/34ee6b70c50f3f2556796b3c79d3f76cc05c89ecec1bb5b12a6d6cbfae23e058.png',
            recommend: ['MATIC', 'WMATIC', 'WETH', 'USDT', 'USDC', 'DAI', 'WBTC']
        },
        avalanche: {
            tokenList_urls: ['https://tokens.coingecko.com/avalanche/all.json'],
            logo_url: 'https://file.fxwallet.com/1679972090672-avax.png',
            recommend: ['AVAX', 'WAVAX', 'WETH', 'USDT', 'USDC', 'DAI', 'WBTC']
        },
        fantom: {
            tokenList_urls: ['https://tokens.coingecko.com/fantom/all.json'],
            logo_url: 'https://file.fxwallet.com/default/1683530682226-ftm.png',
            recommend: ['FTM', 'WFTM', 'WETH', 'USDT', 'USDC', 'DAI', 'WBTC']
        },
        optimism: {
            tokenList_urls: ['https://tokens.coingecko.com/optimistic-ethereum/all.json'],
            logo_url:
                'https://file.fxwallet.com/token/2a53bc62dff62b5ee60e2297032990fc9bddf3b80c30e0a3ea8945d447a71cba.svg',
            recommend: ['OP', 'WETH', 'USDT', 'USDC', 'DAI', 'WBTC']
        },
        arbitrum: {
            tokenList_urls: ['https://tokens.coingecko.com/arbitrum-one/all.json'],
            logo_url:
                'https://file.fxwallet.com/token/cea438da55ced2ac65bea8d4aab84a3b53d723da7c0feed25446f9879ce1433e.svg',
            recommend: ['WETH', 'USDT', 'USDC', 'DAI', 'WBTC']
        }
    }
};
