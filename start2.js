const express = require("express");
const { ethers } = require("ethers");
const app = express();
const config = require("./config.js");
const port = config.port;
const provider = new ethers.providers.JsonRpcProvider(config.rpc);
const wallet = new ethers.Wallet(
    "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d",
    provider
);
const signer = provider.getSigner(wallet.address);
const MAX_INT = "115792089237316195423570985008687907853269984665640564039457584007913129639934";
const IAToken = require("./IAToken.json");
const IERC20 = require("./IERC20.json");
const ERC20ABI = require("./ERC20.json");
const AAVEPOOLV2ABI = require("./aavev2.json");
const UniswapV2Factory = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const ShibaswapFactory = "0x115934131916C8b277DD010Ee02de363c09d037c";
const SushiswapFactory = "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac";
const IUniswapV2Factory = require("./IUniswapV2Factory.json");
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const ONEINCH_ADDRESS = "0x111111111117dC0aa78b770fA6A738034120C302";
const UNI_ADDRESS = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const UNISWAPV3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const SUSHI_ROUTER = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
const SHIBA_ROUTER = "0x03f7724180AA6b939894B5Ca4314783B0b36b329";
const AAVEPOOLV2_ADDRESS = "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9";
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const ADAI_ADDRESS = "0x028171bCA77440897B824Ca71D1c56caC55b68A3";
const AUSDC_ADDRESS = "0xBcca60bB61934080951369a648Fb03DF4F96263C";
const V3QUOTE_ADDRESS_V2 = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
const V3QUOTEABI2 = require("./v3quote2.json");
const FXSWAPABI = require("./fxswap.json");
const FXSWAPABI2 = require("./fxswap2.json");
const FXSWAP_ADDRESS = config.FXSWAP_ADDRESS;
const uniswapV2Handler_ADDRESS = config.uniswapV2Handler_ADDRESS;
const uniswapV3Handler_ADDRESS = config.uniswapV3Handler_ADDRESS;
const aaveV2Handler_ADDRESS = config.aaveV2Handler_ADDRESS;

const uniswapv3_fee = 3000;

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
    "0xDf7FF54aAcAcbFf42dfe29DD6144A69b629f8C9e",
];


class Uniswapv3helper {
    // 每个helper处理一种swap， token1是输入token，token2是输出token,amountIn是输入数量，part是分成多少份, 根据输入数量和分成份数，计算输出数量
    async getOutputTokenByExactInput(
        token1,
        token2,
        amountIn,
        fee,
        router,
        part
    ) {
        const contract = new ethers.Contract(router, V3QUOTEABI2, signer);

        const queries = [];
		for (let i =1 ;i<=part;i++){
			queries.push(contract.callStatic.quoteExactInputSingle({tokenIn:token1,tokenOut:token2,fee,amountIn:String(amountIn*i/part),sqrtPriceLimitX96:0}));
		}

        const ans = await Promise.all(queries);
        const res = [];
        res.push(0);
        for (let i = 0; i < part; i++) {
            res.push(ans[i].amountOut.toNumber())
        }
      
        return res;
    }
}



class Uniswapv2helper {
    async getOutputTokenByExactInput(
        token1,
        token2,
        amountIn,
        router,
        part
    ) {
        const contract = new ethers.Contract(router, IUniswapV2Factory, signer);

        if (token1 === ETH_ADDRESS) {
            token1 = WETH_ADDRESS;
        }
        if (token2 === ETH_ADDRESS) {
            token2 = WETH_ADDRESS;
        }

        const pool = await contract.getPair(token1, token2);
        if (pool === "0x0000000000000000000000000000000000000000") {
            return new Array(Number(part) + 1).fill(0)
        }

        const token1Contract = new ethers.Contract(token1, IERC20, signer);
        const token2Contract = new ethers.Contract(token2, IERC20, signer);
        const token1Balance = await token1Contract.balanceOf(pool);
        const token2Balance = await token2Contract.balanceOf(pool);

        const res = [];
        for (let i = 0; i <= part; i++) {
            const amountIn_part = (amountIn * i) / part;
            res.push(
                (amountIn_part * token2Balance * 997) /
                (token1Balance * 1000 + amountIn_part * 997)
            );
        }
      
        return res;
    }
}

class Aavehelper {
    async getOutputTokenByExactInput(
        token1,
        token2,
        amountIn,
        router,
        part
    ) {
        // aave 1：1 兑换比例
        part = Number(part);
        if (aaveTokenList.includes(token1) || aaveTokenList.includes(token2)) {
            const res = new Array(part + 1).fill(0);
            for (let i = 0; i <= part; i++) {
                res[i] = (amountIn * i) / part;
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
    const returnAmount = answer[n - 1][s] == -1e72 ? 0 : answer[n - 1][s];

    return { returnAmount, distribution };
}

async function getDisplayInformation(srcToken,destToken,inputAmounts,returnAmount){
    // 返回给前端的显示信息
    const display = [
        { name: "FxSwap", price: returnAmount/inputAmounts, youGet: returnAmount, fees: 8.88 }
    ];
    const queries = [];
    const UniswapV2Factories = [SushiswapFactory,ShibaswapFactory,UniswapV2Factory];  // 都是基于uni的v2协议 
    let uniswapv2helper = new Uniswapv2helper();
    for(let i = 0; i < UniswapV2Factories.length; i++){
        queries.push(uniswapv2helper.getOutputTokenByExactInput(
            srcToken,
            destToken,
            inputAmounts,
            UniswapV2Factories[i],
            1
        ).catch((e) => {return Promise.resolve("noResult");}))
    }

    const uniswapv3helper = new Uniswapv3helper();
    queries.push(uniswapv3helper.getOutputTokenByExactInput(srcToken,destToken,inputAmounts,uniswapv3_fee,V3QUOTE_ADDRESS_V2,1).catch((e) => {return Promise.resolve("noResult");}));

    const aavehelper = new Aavehelper();
    queries.push(aavehelper.getOutputTokenByExactInput(srcToken,destToken,inputAmounts,AAVEPOOLV2_ADDRESS,1).catch((e) => {return Promise.resolve("noResult");}));


    let matrix = [];
    const partResults = await Promise.all(queries);
    for(let i = 0; i < partResults.length; i++){
        if(partResults[i] === "noResult"){
            matrix.push([0,0]);
        }else{
            matrix.push(partResults[i]);
        }

    }

    const name_string = ["Sushiswap","Shibaswap","UniswapV2","UniswapV3","AaveV2"];
    for(let i = 0; i<name_string.length; i++){
        display.push({name: name_string[i],price: matrix[i][1]/inputAmounts,youGet: matrix[i][1],fees: 8.88 });
    }

    return display;


}

async function buildTrades(paths){
    // 路由具体逻辑的构造
    const abiEncoder = new ethers.utils.AbiCoder();
    const trades = [];
    for(let i = 0; i < paths.length; i++){
        const sourceToken = paths[i][0];
        const destinationToken = paths[i][1];
        const amount = paths[i][2];
        const path = paths[i];
        const _distribution = paths[i][3];
        const distribution = [];
        const orders = [];
        if(_distribution[0]>0){ // sushiswap
            distribution.push(_distribution[0]);
            const encodedPayload = abiEncoder.encode(["address","address","address","uint256","uint256","uint256"],
			    [SUSHI_ROUTER, sourceToken, destinationToken, amount,MAX_INT,0]
	    	) 
            orders.push(
                {
                    "exchangeHandler" : uniswapV2Handler_ADDRESS, // orders经由部署 UniswapV2Handler合约进行处理
                    "encodedPayload" : encodedPayload
                }
            )
        }
        if(_distribution[1]>0){ // shibaswap
            distribution.push(_distribution[1]);
            const encodedPayload = abiEncoder.encode(["address","address","address","uint256","uint256","uint256"],
			    [SHIBA_ROUTER, sourceToken, destinationToken, amount,MAX_INT,0]
	    	) 
            orders.push(
                {
                    "exchangeHandler" : uniswapV2Handler_ADDRESS, // orders经由部署 UniswapV2Handler合约进行处理
                    "encodedPayload" : encodedPayload
                }
            )
        }
        if(_distribution[2]>0){ // uniswapv2
            distribution.push(_distribution[2]);
            const encodedPayload = abiEncoder.encode(["address","address","address","uint256","uint256","uint256"],
			    [UNISWAP_ROUTER, sourceToken, destinationToken, amount,MAX_INT,0]
	    	) 
            orders.push(
                {
                    "exchangeHandler" : uniswapV2Handler_ADDRESS, // orders经由部署 UniswapV2Handler合约进行处理
                    "encodedPayload" : encodedPayload
                }
            )
        }
        if(_distribution[3]>0){ // uniswapv3
            distribution.push(_distribution[3]);
            const encodedPayload = abiEncoder.encode(["address","address","address","uint256","uint256","uint256","uint24","uint160"],
                [UNISWAPV3_ROUTER, sourceToken, destinationToken, amount,MAX_INT,0,uniswapv3_fee,0]  // 默认0.3%手续费
            ) 
            orders.push(
                {
                    "exchangeHandler" : uniswapV3Handler_ADDRESS, // orders经由部署 UniswapV3Handler合约进行处理
                    "encodedPayload" : encodedPayload
                }
            )
        }
        if(_distribution[4]>0){ // aave
            distribution.push(_distribution[4]);
            const encodedPayload = abiEncoder.encode(["address","address","uint256","uint256"],
            [sourceToken, destinationToken,amount, aaveTokenList.includes(sourceToken) ? 1: 2] 
            ) 
            orders.push(
                {
                    "exchangeHandler" : aaveV2Handler_ADDRESS, // orders经由部署 aaveV2Handler合约进行处理
                    "encodedPayload" : encodedPayload
                }
            )
        }
        const trade = {
            sourceToken,
            destinationToken,
            amount,
            distribution,
            orders
        };
        trades.push(trade);
    }

    return trades;

}

async function routerPath1(srcToken, destToken, inputAmounts, part) {
    const paths = [];

    // 先做第一层转换，例如aave和compound, 都是Defi的token与对应token的转换
    if (aaveTokenList.includes(srcToken)) {
        const contract = new ethers.Contract(srcToken, IAToken, signer);
        const UNDERLYING_ASSET_ADDRESS = await contract.UNDERLYING_ASSET_ADDRESS();
        paths.push([srcToken, UNDERLYING_ASSET_ADDRESS, inputAmounts, [0, 0, 0, 0, 1], 1]); // 最后的1代表deposit
        srcToken = UNDERLYING_ASSET_ADDRESS;
    }
    // if (compoundTokenList.includes(srcToken))  如果源token是ctoken
    inputAmounts = inputAmounts; //第一层转换后更新inputAmounts

    let tmp = destToken;
    // 最后一层转换
    if (aaveTokenList.includes(destToken)) {
        const contract = new ethers.Contract(destToken, IAToken, signer);
        destToken = await contract.UNDERLYING_ASSET_ADDRESS();
    }
    // if (compoundTokenList.includes(destToken))  如果目标token是ctoken
    
    const queries = [];
    const UniswapV2Factories = [SushiswapFactory,ShibaswapFactory,UniswapV2Factory];  // 都是基于uni的v2协议 
    let uniswapv2helper = new Uniswapv2helper();
    for(let i = 0; i < UniswapV2Factories.length; i++){
        queries.push(uniswapv2helper.getOutputTokenByExactInput(
            srcToken,
            destToken,
            inputAmounts,
            UniswapV2Factories[i],
            part
        ))
    }

    const uniswapv3helper = new Uniswapv3helper();
    queries.push(uniswapv3helper.getOutputTokenByExactInput(srcToken,destToken,inputAmounts,uniswapv3_fee,V3QUOTE_ADDRESS_V2,part));

    const aavehelper = new Aavehelper();
    queries.push(aavehelper.getOutputTokenByExactInput(srcToken,destToken,inputAmounts,AAVEPOOLV2_ADDRESS,part));
    
    // matrix矩阵保存每个swap进行part划分后计算得到的金额结果，例如 
    /*
        [
            [0,1,2,3],
            [0,2,4,6],
            [0,3,6,9],
            [0,4,8,12]
        ]
        这是part=3的情形，第一行的0代表输入金额为0时，输出的数量， 第一行的1代表输入金额为总的1/3时输出的数量，第一行的2代表输入金额为总的2/3时输出的数量,以此类推
    */
    let matrix = [];  

    const partResults = await Promise.all(queries);
    for(let i = 0; i < partResults.length; i++){
        matrix.push(partResults[i]);
    }

    // 计算最优路径
    let { returnAmount, distribution } = findBestDistribution(part, matrix);

    // 归一化distribution数组
    let distribution_count = 0;
    for(let i = 0; i < distribution.length; i++){
        distribution_count += distribution[i];
    }
    for(let i = 0; i < distribution.length; i++){
        distribution[i] = Math.round(distribution[i]/distribution_count*100);
    }
    
    console.log(returnAmount, distribution);
    paths.push([srcToken, destToken, 0, distribution, 0]);  // 添加路径


    // 特殊token的转换，例如aave和compound
    destToken = tmp;
    if (aaveTokenList.includes(destToken)) {
        const contract = new ethers.Contract(destToken, IAToken, signer);
        const address = await contract.UNDERLYING_ASSET_ADDRESS();
        paths.push([address, destToken, 0, [0, 0, 0, 0, 1], 2]);
    }

    // 过滤掉相同的token路径
    const res = [];
    for (let i = 0; i < paths.length; i++) {
        if (paths[i][0] !== paths[i][1]) {
            res.push(paths[i]);
        }
    }

    // returnAmount 代表中间swap时返回的数量
    // distribution 代表中间swap时的分配比例 
    // paths 代表最终的路径
    return {returnAmount, distribution, paths: res};
}

app.get("/", (req, res) => {
    res.send("Hello FxSwap!");
});

app.get("/quote", async (req, res) => {
    const srcToken = req.query.srcToken;  // 源token
    const destToken = req.query.destToken;  // 目标token
    const inputAmounts = req.query.inputAmounts; // 源token数量
    const part = req.query.part;    // 分成几份进行计算
    const slippage = req.query.slippage; // 滑点
    const address = req.query.address; // 用户地址
    const depth = Number(req.query.depth); // 搜索深度

    const uniswapGas = 150000; // uniswap 估计gas
    const ETHprice = 2000; // 假设2000usd

    // 深度为1
    if (depth == 1) {
        // 获取最优路径
        let bestPath = await routerPath1(srcToken, destToken, inputAmounts, part);

        // 获取展示信息
        let display = await getDisplayInformation(srcToken, destToken, inputAmounts, bestPath.returnAmount);
        
        // 构造交易数据
        const trades = await buildTrades(bestPath.paths);
        let iface = new ethers.utils.Interface(FXSWAPABI2);
        const txData = iface.encodeFunctionData("performSwapCollection", [
			{
				"swaps":[ 
					{
						"trades":trades   // 只支持一条路径
					}
				]
			},
            srcToken, 
			destToken,  
			inputAmounts
        ]
        );

        res.send({bestPath,display,txData});
        return;
    }


    if (depth == 2) {


    }




});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
