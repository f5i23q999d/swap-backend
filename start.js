const express = require("express");
const { ethers } = require("ethers");
const app = express();
const config = require("./config.js");
const port = config.port;
const provider = new ethers.providers.JsonRpcProvider(config.rpc);
const wallet = new ethers.Wallet(
    config.privateKey,
    provider
);
const signer = provider.getSigner(wallet.address);
const MAX_INT = "115792089237316195423570985008687907853269984665640564039457584007913129639934";
const BigNumber = require("bignumber.js");
const ADDRESS = require("./helpers/constant/addresses.js");

const FXSWAPABI = require("./helpers/abi/fxswap.json");
const Aavehelper = require("./helpers/aavehelper.js");
const Uniswapv3helper = require("./helpers/uniswapv3helper.js");
const Uniswapv2helper = require("./helpers/uniswapv2helper.js");
const Dodohelper = require("./helpers/dodohelper.js");
const Util = require("./helpers/utils/util.js");

const uniswapv3_fee = 3000;

function bitAt(num, pos) {
    return (num >> pos) & 1;
}

function uniformDistribution(distribution) {
    let distribution_count = 0;
    for (let i = 0; i < distribution.length; i++) {
        distribution_count += distribution[i];
    }
    for (let i = 0; i < distribution.length; i++) {
        distribution[i] = Math.round(distribution[i] / distribution_count * 100);
    }
    return distribution;
}


function findBestDistributionWithBigNumber(s, amounts) {
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
            answer[i][j] = new BigNumber(-1e72);
        }
        parent[0][j] = 0;
    }

    for (let i = 1; i < n; i++) {
        for (let j = 0; j <= s; j++) {
            answer[i][j] = answer[i - 1][j];
            parent[i][j] = j;

            for (let k = 1; k <= j; k++) {
                if (answer[i - 1][j - k].plus(amounts[i][k]).comparedTo(answer[i][j]) == 1) {
                    answer[i][j] = answer[i - 1][j - k].plus(amounts[i][k]);
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
    const returnAmount = answer[n - 1][s] == new BigNumber(-1e72) ? 0 : answer[n - 1][s];

    return { returnAmount, distribution };
}

async function getDisplayInformation(srcToken, destToken, inputAmounts, bestPath) {
    // 返回给前端的显示信息
    if (srcToken === ADDRESS.ETH) {
        srcToken = ADDRESS.WETH;
    }

    const outputDecimals = destToken === ADDRESS.ETH ? 18 : await Util.getDecimals(destToken, signer);

    const swaps = [
        { name: "FxSwap", price: bestPath.returnAmount / inputAmounts, youGet: bestPath.returnAmount / Math.pow(10, outputDecimals), fees: 8.88 }
    ];
    const queries = [];
    const UniswapV2Factories = [ADDRESS.SushiswapFactory, ADDRESS.ShibaswapFactory, ADDRESS.UniswapV2Factory];  // 都是基于uni的v2协议 
    let uniswapv2helper = new Uniswapv2helper();
    for (let i = 0; i < UniswapV2Factories.length; i++) {
        queries.push(uniswapv2helper.getOutputByExactInput(
            srcToken,
            destToken,
            inputAmounts,
            UniswapV2Factories[i],
            1,
            signer
        ).catch((e) => { return Promise.resolve("noResult"); }))
    }

    const uniswapv3helper = new Uniswapv3helper();
    queries.push(uniswapv3helper.getOutputByExactInput(srcToken, destToken, inputAmounts, uniswapv3_fee, ADDRESS.V3QUOTE_V2, 1, signer).catch((e) => { return Promise.resolve("noResult"); }));

    const aavehelper = new Aavehelper();
    queries.push(aavehelper.getOutputByExactInput(srcToken, destToken, inputAmounts, ADDRESS.AAVEPOOLV2, 1, signer).catch((e) => { return Promise.resolve("noResult"); }));

    const dodohelper = new Dodohelper();
    queries.push(dodohelper.getOutputByExactInput(srcToken, destToken, inputAmounts, null, 1, signer).catch((e) => { return Promise.resolve("noResult"); }));

    let matrix = [];
    const partResults = await Promise.all(queries);
    for (let i = 0; i < partResults.length; i++) {
        if (partResults[i] === "noResult") {
            matrix.push([0, 0]);
        } else {
            matrix.push(partResults[i]);
        }

    }

    const name_string = ["Sushiswap", "Shibaswap", "UniswapV2", "UniswapV3", "AaveV2", "Dodo"];
    for (let i = 0; i < name_string.length; i++) {
        swaps.push({ name: name_string[i], price: matrix[i][1] / inputAmounts, youGet: matrix[i][1] / Math.pow(10, outputDecimals), fees: 8.88 });
    }


    // 构建paths对象
    const paths = [[]]; // 暂时只有一条路线

    for(let i = 0 ;i<bestPath.paths.length;i++){
        let path = bestPath.paths[i].path;

        path[3] = uniformDistribution(path[3]);
        const tmp = [];
        for(let j = 0 ;j<path[3].length;j++){
        if(path[3][j] > 0){
            tmp.push({
                name : name_string[j],
                part : path[3][j],
                source_token : path[0],
                target_token : path[1],
            });
            paths[0].push(tmp);
        } 
    }
        
    }


    const result = {
        source_token : srcToken,
        target_token : destToken,
        source_token_amount : inputAmounts,
        target_token_amount : bestPath.returnAmount,
        paths : paths,
        swaps : swaps,
    }


    return result;


}

async function buildTrades(paths) {
    // 路由具体逻辑的构造
    const abiEncoder = new ethers.utils.AbiCoder();
    const trades = [];
    for (let i = 0; i < paths.length; i++) {
        const sourceToken = paths[i][0];
        const destinationToken = paths[i][1];
        const amount = 0;//paths[i][2];  amount全为0，仅根据distribution来获得
        const path = paths[i];
        const _distribution = paths[i][3];
        const distribution = [];
        const orders = [];
        if (_distribution[0] > 0) { // sushiswap
            distribution.push(_distribution[0]);
            const encodedPayload = abiEncoder.encode(["address", "address", "address", "uint256", "uint256", "uint256"],
                [ADDRESS.SUSHI_ROUTER, sourceToken, destinationToken, amount, MAX_INT, 0]
            )
            orders.push(
                {
                    "exchangeHandler": config.uniswapV2Handler_ADDRESS, // orders经由部署 UniswapV2Handler合约进行处理
                    "encodedPayload": encodedPayload
                }
            )
        }
        if (_distribution[1] > 0) { // shibaswap
            distribution.push(_distribution[1]);
            const encodedPayload = abiEncoder.encode(["address", "address", "address", "uint256", "uint256", "uint256"],
                [ADDRESS.SHIBA_ROUTER, sourceToken, destinationToken, amount, MAX_INT, 0]
            )
            orders.push(
                {
                    "exchangeHandler": config.uniswapV2Handler_ADDRESS, // orders经由部署 UniswapV2Handler合约进行处理
                    "encodedPayload": encodedPayload
                }
            )
        }
        if (_distribution[2] > 0) { // uniswapv2
            distribution.push(_distribution[2]);
            const encodedPayload = abiEncoder.encode(["address", "address", "address", "uint256", "uint256", "uint256"],
                [ADDRESS.UNISWAP_ROUTER, sourceToken, destinationToken, amount, MAX_INT, 0]
            )
            orders.push(
                {
                    "exchangeHandler": config.uniswapV2Handler_ADDRESS, // orders经由部署 UniswapV2Handler合约进行处理
                    "encodedPayload": encodedPayload
                }
            )
        }
        if (_distribution[3] > 0) { // uniswapv3
            distribution.push(_distribution[3]);
            const encodedPayload = abiEncoder.encode(["address", "address", "address", "uint256", "uint256", "uint256", "uint24", "uint160"],
                [ADDRESS.UNISWAPV3_ROUTER, sourceToken, destinationToken, amount, MAX_INT, 0, uniswapv3_fee, 0]  // 默认0.3%手续费
            )
            orders.push(
                {
                    "exchangeHandler": config.uniswapV3Handler_ADDRESS, // orders经由部署 UniswapV3Handler合约进行处理
                    "encodedPayload": encodedPayload
                }
            )
        }
        if (_distribution[4] > 0) { // aave
            distribution.push(_distribution[4]);
            const aavehelper = new Aavehelper();
            const encodedPayload = abiEncoder.encode(["address", "address", "uint256", "uint256"],
                [sourceToken, destinationToken, amount, aavehelper.isAToken(sourceToken) ? 1 : 2]
            )
            orders.push(
                {
                    "exchangeHandler": config.aaveV2Handler_ADDRESS, // orders经由部署 aaveV2Handler合约进行处理
                    "encodedPayload": encodedPayload
                }
            )
        }
        if (_distribution[5] > 0) { // dodo
            distribution.push(_distribution[5]);
            const dodohelper = new Dodohelper();
            const { pool, token1IsBase, version } = await dodohelper.tokenInfo(sourceToken, destinationToken, signer);
            const encodedPayload = abiEncoder.encode(["address", "address", "address", "uint256", "uint256", "bool", "address"],
                [sourceToken, destinationToken, pool, amount, version, token1IsBase, ADDRESS.DODO_HELPER]
            )
            orders.push(
                {
                    "exchangeHandler": config.dodoHandler_ADDRESS, // orders经由部署 aaveV2Handler合约进行处理
                    "encodedPayload": encodedPayload
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


async function routerPath1(srcToken, destToken, inputAmounts, part, flag) {   //深度是1
    // dex顺序 [sushiswap,shibaswap,uniswapv2,uniswapv3,aave,dodo]

    const paths = [];

    // 先做第一层转换，例如aave和compound, 都是Defi的token与对应token的转换
    const aavehelper = new Aavehelper();
    if (aavehelper.isAToken(srcToken)) {
        if (bitAt(flag, 4) == 0) {
            return { returnAmount: 0, distribution: [0, 0, 0, 0, 0, 0], paths: [] };// 如果初始token是atoken且没有激活aave协议，则不能进行swap
        }
        const UNDERLYING_ASSET_ADDRESS = aavehelper.getUnderlyingToken(srcToken);
        paths.push({returnAmount : inputAmounts, path: [srcToken, UNDERLYING_ASSET_ADDRESS, inputAmounts, [0, 0, 0, 0, 1, 0], 1]}); // 最后的1代表aave的deposit
        srcToken = UNDERLYING_ASSET_ADDRESS;
    }
    // if (compoundhelper.isCToken(srcToken))  如果源token是ctoken
    inputAmounts = inputAmounts; //第一层转换后更新inputAmounts

    let tmp = destToken;
    // 最后一层转换
    if (aavehelper.isAToken(destToken)) {
        destToken = aavehelper.getUnderlyingToken(destToken);
    }
    // if (compoundhelper.isCToken(srcToken))   如果目标token是ctoken

    const queries = []; // 查询队列
    let uniswapv2helper = new Uniswapv2helper(); // 都是基于uni的v2协议 
    bitAt(flag, 0) == 1 ? queries.push(uniswapv2helper.getOutputByExactInput(srcToken, destToken, inputAmounts, ADDRESS.SushiswapFactory, part, signer)) : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));
    bitAt(flag, 1) == 1 ? queries.push(uniswapv2helper.getOutputByExactInput(srcToken, destToken, inputAmounts, ADDRESS.ShibaswapFactory, part, signer)) : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));
    bitAt(flag, 2) == 1 ? queries.push(uniswapv2helper.getOutputByExactInput(srcToken, destToken, inputAmounts, ADDRESS.UniswapV2Factory, part, signer)) : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));

    const uniswapv3helper = new Uniswapv3helper();
    bitAt(flag, 3) == 1 ? queries.push(uniswapv3helper.getOutputByExactInput(srcToken, destToken, inputAmounts, uniswapv3_fee, ADDRESS.V3QUOTE_V2, part, signer)) : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));


    bitAt(flag, 4) == 1 ? queries.push(aavehelper.getOutputByExactInput(srcToken, destToken, inputAmounts, ADDRESS.AAVEPOOLV2, part, signer)) : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));

    const dodohelper = new Dodohelper();
    bitAt(flag, 5) == 1 ? queries.push(dodohelper.getOutputByExactInput(srcToken, destToken, inputAmounts, null, part, signer)) : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));

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
    for (let i = 0; i < partResults.length; i++) {
        matrix.push(partResults[i]);
    }

    // 计算最优路径
    let { returnAmount, distribution } = findBestDistributionWithBigNumber(part, matrix);

    // 归一化distribution数组
    distribution = uniformDistribution(distribution);

    console.log(returnAmount, distribution);
    paths.push({returnAmount : returnAmount, path: [srcToken, destToken, 0, distribution, 0]});  // 添加路径


    // 特殊token的转换，例如aave和compound
    destToken = tmp;
    if (aavehelper.isAToken(destToken)) {
        if (bitAt(flag, 4) == 0) {
            return { returnAmount: 0, distribution: [0, 0, 0, 0, 0, 0], paths: [] };// 不能进行swap
        }
        const address = aavehelper.getUnderlyingToken(destToken);
        paths.push({returnAmount : returnAmount,path:[address, destToken, 0, [0, 0, 0, 0, 1, 0], 2]});
    }

    // 过滤掉相同的token路径
    const res = [];
    for (let i = 0; i < paths.length; i++) {
        if (paths[i][0] !== paths[i][1]) {
            res.push(paths[i]);
        }
    }

    // returnAmount 代表中间swap时返回的数量
    // paths 代表最终的路径
    return { returnAmount, paths};
}


async function _queryBetweenInputAndOutput(srcToken, destToken, inputAmounts, part, flag) {
    const aavehelper = new Aavehelper();
    let uniswapv2helper = new Uniswapv2helper();
    const uniswapv3helper = new Uniswapv3helper();
    const dodohelper = new Dodohelper();
    const queries = []; // 查询队列
    bitAt(flag, 0) == 1 ? queries.push(uniswapv2helper.getOutputByExactInput(srcToken, destToken, inputAmounts, ADDRESS.SushiswapFactory, part, signer)) : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));
    bitAt(flag, 1) == 1 ? queries.push(uniswapv2helper.getOutputByExactInput(srcToken, destToken, inputAmounts, ADDRESS.ShibaswapFactory, part, signer)) : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));
    bitAt(flag, 2) == 1 ? queries.push(uniswapv2helper.getOutputByExactInput(srcToken, destToken, inputAmounts, ADDRESS.UniswapV2Factory, part, signer)) : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));
    bitAt(flag, 3) == 1 ? queries.push(uniswapv3helper.getOutputByExactInput(srcToken, destToken, inputAmounts, uniswapv3_fee, ADDRESS.V3QUOTE_V2, part, signer)) : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));
    bitAt(flag, 4) == 1 ? queries.push(aavehelper.getOutputByExactInput(srcToken, destToken, inputAmounts, ADDRESS.AAVEPOOLV2, part, signer)) : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));
    bitAt(flag, 5) == 1 ? queries.push(dodohelper.getOutputByExactInput(srcToken, destToken, inputAmounts, null, part, signer)) : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));
    let matrix = [];
    let partResults = await Promise.all(queries);
    for (let i = 0; i < partResults.length; i++) {
        matrix.push(partResults[i]);
    }
    let { returnAmount, distribution } = findBestDistributionWithBigNumber(part, matrix);
    let distribution_count = 0;
    for (let i = 0; i < distribution.length; i++) {
        distribution_count += distribution[i];
    }
    for (let i = 0; i < distribution.length; i++) {
        distribution[i] = Math.round(distribution[i] / distribution_count * 100);
    }
    path = [srcToken, destToken, 0, distribution, 0];

    return  {returnAmount:returnAmount.toString(), path};
}


async function _queryBetweenInputAndOutputWithMiddle(srcToken, middle, destToken, inputAmounts, part, flag) {

    const res1 = await _queryBetweenInputAndOutput(srcToken,middle,inputAmounts,part,flag);

    const res2 = await _queryBetweenInputAndOutput(middle,destToken,res1.returnAmount,part,flag);

    return {returnAmount:res2.returnAmount, paths:[res1,res2]};

}


async function routerPath2(srcToken, destToken, inputAmounts, part, flag) { //深度是2
    // dex顺序 [sushiswap,shibaswap,uniswapv2,uniswapv3,aave,dodo]

    const paths = [];

    // 先做第一层转换，例如aave和compound, 都是Defi的token与对应token的转换
    const aavehelper = new Aavehelper();
    if (aavehelper.isAToken(srcToken)) {
        if (bitAt(flag, 4) == 0) {
            return { returnAmount: 0, distribution: [0, 0, 0, 0, 0, 0], paths: [] };// 如果初始token是atoken且没有激活aave协议，则不能进行swap
        }
        const UNDERLYING_ASSET_ADDRESS = aavehelper.getUnderlyingToken(srcToken);
        paths.push({returnAmount: 0, path: [srcToken, UNDERLYING_ASSET_ADDRESS, inputAmounts, [0, 0, 0, 0, 1, 0], 1]}); // 最后的1代表aave的deposit
        srcToken = UNDERLYING_ASSET_ADDRESS;
    }
    // if (compoundhelper.isCToken(srcToken))  如果源token是ctoken
    inputAmounts = inputAmounts; //第一层转换后更新inputAmounts

    let tmp = destToken;
    // 最后一层转换
    if (aavehelper.isAToken(destToken)) {
        destToken = aavehelper.getUnderlyingToken(destToken);
    }
    // if (compoundhelper.isCToken(srcToken))   如果目标token是ctoken


    const middleToken = [ADDRESS.WETH, ADDRESS.USDT];

    const queries = [];
    for(const middle of middleToken){
        queries.push(_queryBetweenInputAndOutputWithMiddle(srcToken, middle, destToken, inputAmounts, part, flag));
    }
    const queryResults = await Promise.all(queries);
    let maxIndex = 0;
    let maxReturnAmount = new BigNumber(0);
    for (let i = 0; i < queryResults.length; i++) {
        if ((new BigNumber(queryResults[i].returnAmount)).isGreaterThan(maxReturnAmount)) {
            maxReturnAmount = queryResults[i].returnAmount;
            maxIndex = i;
        }
    }
    for(let i = 0; i<queryResults[maxIndex].paths.length; i++){
        paths.push(queryResults[maxIndex].paths[i]);
    }

    // 特殊token的转换，例如aave和compound
    destToken = tmp;
    if (aavehelper.isAToken(destToken)) {
        if (bitAt(flag, 4) == 0) {
            return { returnAmount: 0, distribution: [0, 0, 0, 0, 0, 0], paths: [] };// 不能进行swap
        }
        const address = aavehelper.getUnderlyingToken(destToken);
        paths.push({returnAmount: queryResults[maxIndex].returnAmount,path:[address, destToken, 0, [0, 0, 0, 0, 1, 0], 2]});
    }

    // 过滤掉相同的token路径
    const res = [];
    for (let i = 0; i < paths.length; i++) {
        if (paths[i].path[0] !== paths[i].path[1]) {
            res.push(paths[i]);
        }
    }

    return { returnAmount : maxReturnAmount, paths: res };
}

app.get("/", (req, res) => {
    res.send("Hello FxSwap!");
});

app.get("/quote", async (req, res) => {
    const start = new Date().getTime();

    const srcToken = req.query.source_token;  // 源token
    const destToken = req.query.target_token;  // 目标token
    const inputAmounts = req.query.amount; // 源token数量
    const part = req.query.part;    // 分成几份进行计算
    const slippage = isNaN(Number(req.query.slippage)) ? 5 : Number(req.query.slippage); // 滑点
    const senderAddress = req.query.sender_address; // 用户地址
    const receiverAddress = req.query.receiver_address;
    const depth = isNaN(Number(req.query.depth)) ? 1 : Number(req.query.depth); // 搜索深度
    const flag = isNaN(Number(req.query.flag)) ? 2 ** 52 - 1 : Number(req.query.flag); // dex筛选位

    const uniswapGas = 150000; // uniswap 估计gas
    const ETHprice = 2000; // 假设2000usd

   
    let result = {};
    let bestPath = null;

    if (depth == 1){  // 除头尾的特殊转换（aave和compound），中间的遍历深度是1， 例如 adai => dai => usdc =>audc
        bestPath = await routerPath1(srcToken, destToken, inputAmounts, part, flag);
    }

    if (depth == 2){  // 除头尾的特殊转换（aave和compound），中间的遍历深度是2， 例如 adai => dai => usdt => usdc =>audc
        bestPath = await routerPath2(srcToken, destToken, inputAmounts, part, flag);
    }

    let display = await getDisplayInformation(srcToken, destToken, inputAmounts, bestPath);
    result.source_token = srcToken;
    result.target_token = destToken;
    result.source_token_amount = inputAmounts;
    result.target_token_amount = display.target_token_amount;
    result.swaps = display.swaps;
    result.paths = display.paths;
    result.minimumReceived = (new BigNumber(display.swaps[0].youGet.toFixed(6))).multipliedBy(1000 - slippage).dividedBy(1000).toString();
    result.estimate_gas = 8888888;
    result.estimate_cost = 9.99;
    result.minimum_reception = 1000;
    result.price_impact = 10.99;

    const paths = [];
    for (let i = 0; i < bestPath.paths.length; i++) {
        paths.push(bestPath.paths[i].path);
    }

    const trades = await buildTrades(paths);
    let iface = new ethers.utils.Interface(FXSWAPABI);
    const txData = iface.encodeFunctionData("performSwapCollection", [
        {
            "swaps": [
                {
                    "trades": trades   // 只支持一条路径
                }
            ]
        },
        srcToken,
        destToken,
        inputAmounts
    ]
    );

    result.tx_data = txData;
    
    res.send(result);     

    


    const end = new Date().getTime();
    console.log("耗时: " + (end - start) + "ms");

});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
