const express = require('express');
const { ethers } = require("ethers");
const app = express();
const config = require('./config.js');
const port = config.port;
const provider = new ethers.providers.JsonRpcProvider(config.rpc);
const wallet = new ethers.Wallet("0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d", provider);
const signer = provider.getSigner(wallet.address);
const IAToken = require('./IAToken.json');
const IERC20 = require('./IERC20.json');
const ERC20ABI = require('./ERC20.json');
const AAVEPOOLV2ABI = require('./aavev2.json');
const UniswapV2Factory = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const ShibaswapFactory = "0x115934131916C8b277DD010Ee02de363c09d037c";
const SushiswapFactory = "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac";
const IUniswapV2Factory = require('./IUniswapV2Factory.json');
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const ONEINCH_ADDRESS = "0x111111111117dC0aa78b770fA6A738034120C302";
const UNI_ADDRESS = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const SUSHI_ROUTER = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
const AAVEPOOLV2_ADDRESS = "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9";
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const ADAI_ADDRESS = "0x028171bCA77440897B824Ca71D1c56caC55b68A3";
const AUSDC_ADDRESS = "0xBcca60bB61934080951369a648Fb03DF4F96263C";
const FXSWAPABI = require('./fxswap.json');
const FXSWAP_ADDRESS = config.FXSWAP_ADDRESS;
const aaveTokenList = [
    "0xFFC97d72E13E01096502Cb8Eb52dEe56f74DAD7B",
    "0x05Ec93c0365baAeAbF7AefFb0972ea7ECdD39CF1",
    "0xA361718326c15715591c299427c62086F69923D9",
    "0x028171bCA77440897B824Ca71D1c56caC55b68A3",
    "0xaC6Df26a590F08dcC95D5a4705ae8abbc88509Ef",
    "0x39C6b3e42d6A679d7D776778Fe880BC9487C2EDA",
    "0xa06bC25B5805d5F8d82847D191Cb4Af5A3e873E0",
    "0xa685a61171bb30d4072B338c80Cb7b2c865c873E",
    "0xc713e5E149D5D0715DcD1c156a020976e7E56B88",
    "0x35f6B052C598d933D69A4EEC4D04c73A191fE6c2",
    "0x6C5024Cd4F8A59110119C56f8933403A539555EB",
    "0xB9D7CB55f463405CDfBe4E90a6D2Df01C2B92BF1",
    "0xBcca60bB61934080951369a648Fb03DF4F96263C",
    "0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811",
    "0x9ff58f4fFB29fA2266Ab25e75e2A8b3503311656",
    "0x030bA81f1c18d280636F32af80b9AAd02Cf0854e",
    "0xDf7FF54aAcAcbFf42dfe29DD6144A69b629f8C9e"
];


class uniswapv2helper {

    async getEstimatedToken1forExactToken2(token1, token2, amountIn, router, part) {

        const contract = new ethers.Contract(router, IUniswapV2Factory, signer);

        if (token1 === ETH_ADDRESS) {
            token1 = WETH_ADDRESS
        }
        if (token2 === ETH_ADDRESS) {
            token2 = WETH_ADDRESS
        }

        const pool = await contract.getPair(token1, token2);
        //console.log(pool);
        if (pool === "0x0000000000000000000000000000000000000000") {
            return {price:0,youGet:0,distribution:new Array(Number(part) + 1).fill(0)};
        }
        const token1Contract = new ethers.Contract(token1, IERC20, signer);
        const token2Contract = new ethers.Contract(token2, IERC20, signer);
        const token1Balance = await token1Contract.balanceOf(pool);
        const token2Balance = await token2Contract.balanceOf(pool);

        const res = [];
        for (let i = 0; i <= part; i++) {
            const amountIn_part = amountIn * i / part;
            res.push(amountIn_part * token2Balance * 997 / (token1Balance * 1000 + amountIn_part * 997));
        }
        const price = amountIn * token2Balance * 997 / ((token1Balance * 1000 + amountIn * 997) * amountIn);
        const youGet = amountIn * token2Balance * 997 / (token1Balance * 1000 + amountIn * 997);
        //console.log(res);
        return { price, youGet, distribution: res };
    }

}

class aavehelper {
    async getEstimatedToken1forExactToken2(token1, token2, amountIn, router, part) {
        if (token1 === ADAI_ADDRESS || token2 === ADAI_ADDRESS) {
            const res = new Array(part + 1).fill(0);
            //res[part] = amountIn;
            for (let i = 0; i <= part; i++) {
                res[i] = amountIn * i / part;
            }
            return res;
        }
        return new Array(part + 1).fill(0);
    }

}


function findBestDistribution(s, amounts) {
    const n = amounts.length;

    const answer = new Array(n);
    const parent = new Array(n);

    for (let i = 0; i < n; i++) {
        answer[i] = new Array(s + 1).fill(0);
        parent[i] = new Array(s + 1).fill(0);
    }

    for (let j = 0; j <= s; j++) {
        answer[0][j] = amounts[0][j];
        for (let i = 1; i < n; i++) {
            answer[i][j] = -1e72;
        }
        parent[0][j] = 0;
    }

    for (let i = 1; i < n; i++) {
        for (let j = 0; j <= s; j++) {
            answer[i][j] = answer[i - 1][j];
            parent[i][j] = j;

            for (let k = 1; k <= j; k++) {
                if (answer[i - 1][j - k] + amounts[i][k] > answer[i][j]) {
                    answer[i][j] = answer[i - 1][j - k] + amounts[i][k];
                    parent[i][j] = j - k;
                }
            }
        }
    }

    const distribution = new Array(n).fill(0);

    let partsLeft = s;
    for (let curExchange = n - 1; partsLeft > 0; curExchange--) {
        distribution[curExchange] = partsLeft - parent[curExchange][partsLeft];
        partsLeft = parent[curExchange][partsLeft];
    }
    const returnAmount = (answer[n - 1][s] == -1e72) ? 0 : answer[n - 1][s];

    return { returnAmount, distribution };
}


async function routerPath(srcToken, destToken, inputAmounts, part) {
    const paths = [];
    const originalSrcToken = srcToken;
    if (aaveTokenList.includes(srcToken)) {
        const contract = new ethers.Contract(srcToken, IAToken, signer);
        const address = await contract.UNDERLYING_ASSET_ADDRESS();
        paths.push([srcToken, address, inputAmounts, [0, 0, 0, 1], 1]);
        srcToken = address;
    }
    let tmp = destToken;
    if (aaveTokenList.includes(destToken)) {
        const contract = new ethers.Contract(destToken, IAToken, signer);
        destToken = await contract.UNDERLYING_ASSET_ADDRESS();
    }
    let u = new uniswapv2helper();
    const promises = [
        u.getEstimatedToken1forExactToken2(srcToken, destToken, inputAmounts, SushiswapFactory, part),
        u.getEstimatedToken1forExactToken2(srcToken, destToken, inputAmounts, ShibaswapFactory, part),
        u.getEstimatedToken1forExactToken2(srcToken, destToken, inputAmounts, UniswapV2Factory, part)
    ];

    const [res1, res2, res3] = await Promise.all(promises);

    let matrix = [];
    matrix.push(res1.distribution);
    matrix.push(res2.distribution);
    matrix.push(res3.distribution);
    let zero = new Array(part + 1).fill(0);
    matrix.push(zero);

    let { returnAmount, distribution } = findBestDistribution(part, matrix);
    console.log(returnAmount, distribution);
    paths.push([srcToken, destToken, 0, distribution, 0]);

    destToken = tmp;
    if (aaveTokenList.includes(destToken)) {
        const contract = new ethers.Contract(destToken, IAToken, signer);
        const address = await contract.UNDERLYING_ASSET_ADDRESS();
        paths.push([address, destToken, 0, [0, 0, 0, 1], 2]);
    }

    const res = [];
    for (let i = 0; i < paths.length; i++) {
        if (paths[i][0] !== paths[i][1]) {
            res.push(paths[i]);
        }
    }

    const display = [
        { name: "FxSwap", price: returnAmount/inputAmounts, youGet: returnAmount }
    ];
    if (aaveTokenList.includes(originalSrcToken) || aaveTokenList.includes(destToken)) {
        const promises = [
            u.getEstimatedToken1forExactToken2(originalSrcToken, destToken, inputAmounts, SushiswapFactory, part),
            u.getEstimatedToken1forExactToken2(originalSrcToken, destToken, inputAmounts, ShibaswapFactory, part),
            u.getEstimatedToken1forExactToken2(originalSrcToken, destToken, inputAmounts, UniswapV2Factory, part)
        ];
        const [res1, res2, res3] = await Promise.all(promises);
        display.push({ name: "Sushiswap", price: res1.price, youGet: res1.youGet });
        display.push({ name: "Shibaswap", price: res2.price, youGet: res2.youGet });
        display.push({ name: "Uniswap", price: res3.price, youGet: res3.youGet });
        return {res,display};
    } else {
        const display =[{ name: "FxSwap", price: returnAmount/inputAmounts, youGet: returnAmount },
        { name: "Sushiswap", price: res1.price, youGet: res1.youGet },
        { name: "Shibaswap", price: res2.price, youGet: res2.youGet },
        { name: "Uniswap", price: res3.price, youGet: res3.youGet }];
        return {res,display};
    }


}


app.get('/', (req, res) => {
    res.send('Hello FxSwap!')
})

app.get('/quote', async (req, res) => {
    const srcToken = req.query.srcToken;
    const destToken = req.query.destToken;
    const inputAmounts = req.query.inputAmounts;
    const part = req.query.part;
    const slippage = req.query.slippage;
    const address = req.query.address;
    
    let details = await routerPath(srcToken, destToken, inputAmounts, part);
    // uniswap 类型 gas 费100000
    const uniswapGas = 150000;
    const gasPrice = await provider.getGasPrice();
    const ETHprice = 2000;// 假设2000usd
    const uniFee = uniswapGas * gasPrice * ETHprice / 1e18;

    const mininumOut = BigInt(Math.floor(details.display[0].youGet * (1000-slippage) * 0.001)).toString();

    let iface = new ethers.utils.Interface(FXSWAPABI);
    const data = iface.encodeFunctionData("swap", [srcToken, destToken, inputAmounts, mininumOut, details.res]);
    details.data = data;
    const user = provider.getSigner(address);
    const FXSWAP = new ethers.Contract(FXSWAP_ADDRESS, FXSWAPABI,user);
    let estimatedGas = 0;
    try{
        if (srcToken == ETH_ADDRESS) {
            estimatedGas = await FXSWAP.estimateGas.swap(srcToken,destToken,inputAmounts,mininumOut,details.res,{value:inputAmounts});
        } else {
            estimatedGas = await FXSWAP.estimateGas.swap(srcToken,destToken,inputAmounts,mininumOut,details.res);
        }
    } catch (err){
        // 无法估计
    }

    for(let i = 0; i < details.display.length; i++) {
        if (details.display[i].name=="FxSwap"){
            details.display[i].fee = estimatedGas * gasPrice * ETHprice / 1e18;
            details.minimumReceived = details.display[i].youGet;
            details.estimatedCost = details.display[i].fee;
        } else{
            details.display[i].fee = uniFee;
        }
    }
    
    res.send(details)
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})