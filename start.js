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
                if (answer[i - 1][j - k].plus(amounts[i][k]).comparedTo(answer[i][j])==1) {
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

async function getDisplayInformation(srcToken,destToken,inputAmounts,returnAmount){
    // 返回给前端的显示信息
    if (srcToken === ADDRESS.ETH) {
        srcToken = ADDRESS.WETH;
    }

    const outputDecimals = destToken === ADDRESS.ETH?18:await Util.getDecimals(destToken, signer);

    const display = [
        { name: "FxSwap", price: returnAmount/inputAmounts, youGet: returnAmount/Math.pow(10,outputDecimals), fees: 8.88 }
    ];
    const queries = [];
    const UniswapV2Factories = [ADDRESS.SushiswapFactory,ADDRESS.ShibaswapFactory,ADDRESS.UniswapV2Factory];  // 都是基于uni的v2协议 
    let uniswapv2helper = new Uniswapv2helper();
    for(let i = 0; i < UniswapV2Factories.length; i++){
        queries.push(uniswapv2helper.getOutputByExactInput(
            srcToken,
            destToken,
            inputAmounts,
            UniswapV2Factories[i],
            1,
            signer
        ).catch((e) => {return Promise.resolve("noResult");}))
    }

    const uniswapv3helper = new Uniswapv3helper();
    queries.push(uniswapv3helper.getOutputByExactInput(srcToken,destToken,inputAmounts,uniswapv3_fee,ADDRESS.V3QUOTE_V2,1,signer).catch((e) => {return Promise.resolve("noResult");}));

    const aavehelper = new Aavehelper();
    queries.push(aavehelper.getOutputByExactInput(srcToken,destToken,inputAmounts,ADDRESS.AAVEPOOLV2,1,signer).catch((e) => {return Promise.resolve("noResult");}));

    const dodohelper = new Dodohelper();
    queries.push(dodohelper.getOutputByExactInput(srcToken,destToken,inputAmounts,null,1,signer).catch((e) => {return Promise.resolve("noResult");}));

    let matrix = [];
    const partResults = await Promise.all(queries);
    for(let i = 0; i < partResults.length; i++){
        if(partResults[i] === "noResult"){
            matrix.push([0,0]);
        }else{
            matrix.push(partResults[i]);
        }

    }

    const name_string = ["Sushiswap","Shibaswap","UniswapV2","UniswapV3","AaveV2","Dodo"];
    for(let i = 0; i<name_string.length; i++){
        display.push({name: name_string[i],price: matrix[i][1]/inputAmounts,youGet: matrix[i][1]/Math.pow(10,outputDecimals),fees: 8.88 });
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
        const amount = 0;//paths[i][2];  amount全为0，仅根据distribution来获得
        const path = paths[i];
        const _distribution = paths[i][3];
        const distribution = [];
        const orders = [];
        if(_distribution[0]>0){ // sushiswap
            distribution.push(_distribution[0]);
            const encodedPayload = abiEncoder.encode(["address","address","address","uint256","uint256","uint256"],
			    [ADDRESS.SUSHI_ROUTER, sourceToken, destinationToken, amount,MAX_INT,0]
	    	) 
            orders.push(
                {
                    "exchangeHandler" : config.uniswapV2Handler_ADDRESS, // orders经由部署 UniswapV2Handler合约进行处理
                    "encodedPayload" : encodedPayload
                }
            )
        }
        if(_distribution[1]>0){ // shibaswap
            distribution.push(_distribution[1]);
            const encodedPayload = abiEncoder.encode(["address","address","address","uint256","uint256","uint256"],
			    [ADDRESS.SHIBA_ROUTER, sourceToken, destinationToken, amount,MAX_INT,0]
	    	) 
            orders.push(
                {
                    "exchangeHandler" : config.uniswapV2Handler_ADDRESS, // orders经由部署 UniswapV2Handler合约进行处理
                    "encodedPayload" : encodedPayload
                }
            )
        }
        if(_distribution[2]>0){ // uniswapv2
            distribution.push(_distribution[2]);
            const encodedPayload = abiEncoder.encode(["address","address","address","uint256","uint256","uint256"],
			    [ADDRESS.UNISWAP_ROUTER, sourceToken, destinationToken, amount,MAX_INT,0]
	    	) 
            orders.push(
                {
                    "exchangeHandler" : config.uniswapV2Handler_ADDRESS, // orders经由部署 UniswapV2Handler合约进行处理
                    "encodedPayload" : encodedPayload
                }
            )
        }
        if(_distribution[3]>0){ // uniswapv3
            distribution.push(_distribution[3]);
            const encodedPayload = abiEncoder.encode(["address","address","address","uint256","uint256","uint256","uint24","uint160"],
                [ADDRESS.UNISWAPV3_ROUTER, sourceToken, destinationToken, amount,MAX_INT,0,uniswapv3_fee,0]  // 默认0.3%手续费
            ) 
            orders.push(
                {
                    "exchangeHandler" : config.uniswapV3Handler_ADDRESS, // orders经由部署 UniswapV3Handler合约进行处理
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
                    "exchangeHandler" : config.aaveV2Handler_ADDRESS, // orders经由部署 aaveV2Handler合约进行处理
                    "encodedPayload" : encodedPayload
                }
            )
        }
        if(_distribution[5]>0){ // dodo
            distribution.push(_distribution[5]);
            const dodohelper = new Dodohelper();
            const {pool,token1IsBase,version} = await dodohelper.tokenInfo(sourceToken,destinationToken,signer);
            const encodedPayload = abiEncoder.encode(["address","address","address","uint256","uint256","bool","address"],
            [sourceToken, destinationToken, pool, amount,version,token1IsBase,ADDRESS.DODO_HELPER]
        )
            orders.push(
                {
                    "exchangeHandler" : config.dodoHandler_ADDRESS, // orders经由部署 aaveV2Handler合约进行处理
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
    const aavehelper = new Aavehelper();
    if (aavehelper.isAToken(srcToken)) {
        const UNDERLYING_ASSET_ADDRESS = aavehelper.getUnderlyingToken(srcToken);
        paths.push([srcToken, UNDERLYING_ASSET_ADDRESS, inputAmounts, [0, 0, 0, 0, 1, 0], 1]); // 最后的1代表deposit
        srcToken = UNDERLYING_ASSET_ADDRESS;
    }
    // if (compoundTokenList.includes(srcToken))  如果源token是ctoken
    inputAmounts = inputAmounts; //第一层转换后更新inputAmounts

    let tmp = destToken;
    // 最后一层转换
    if (aavehelper.isAToken(destToken)) {
        destToken = aavehelper.getUnderlyingToken(destToken);
    }
    // if (compoundTokenList.includes(destToken))  如果目标token是ctoken
    
    const queries = [];
    const UniswapV2Factories = [ADDRESS.SushiswapFactory,ADDRESS.ShibaswapFactory,ADDRESS.UniswapV2Factory];  // 都是基于uni的v2协议 
    let uniswapv2helper = new Uniswapv2helper();
    for(let i = 0; i < UniswapV2Factories.length; i++){
        queries.push(uniswapv2helper.getOutputByExactInput(
            srcToken,
            destToken,
            inputAmounts,
            UniswapV2Factories[i],
            part,
            signer
        ))
    }

    const uniswapv3helper = new Uniswapv3helper();
    queries.push(uniswapv3helper.getOutputByExactInput(srcToken,destToken,inputAmounts,uniswapv3_fee,ADDRESS.V3QUOTE_V2,part,signer));

    
    queries.push(aavehelper.getOutputByExactInput(srcToken,destToken,inputAmounts,ADDRESS.AAVEPOOLV2,part,signer));
    
    const dodohelper = new Dodohelper();
    queries.push(dodohelper.getOutputByExactInput(srcToken,destToken,inputAmounts,null,part,signer));
    
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
    let { returnAmount, distribution } = findBestDistributionWithBigNumber(part, matrix);

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
    if (aavehelper.isAToken(destToken)) {
        const address = aavehelper.getUnderlyingToken(destToken);
        paths.push([address, destToken, 0, [0, 0, 0, 0, 1,0], 2]);
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


async function routerPath2(srcToken, destToken, inputAmounts, part) {
    const paths = [];

    // 先做第一层转换，例如aave和compound, 都是Defi的token与对应token的转换
    const aavehelper = new Aavehelper();
    if (aavehelper.isAToken(srcToken)) {
        const UNDERLYING_ASSET_ADDRESS = aavehelper.getUnderlyingToken(srcToken);
        paths.push([srcToken, UNDERLYING_ASSET_ADDRESS, inputAmounts, [0, 0, 0, 0, 1, 0], 1]); // 最后的1代表deposit
        srcToken = UNDERLYING_ASSET_ADDRESS;
    }
    // if (compoundTokenList.includes(srcToken))  如果源token是ctoken
    inputAmounts = inputAmounts; //第一层转换后更新inputAmounts

    let tmp = destToken;
    // 最后一层转换
    if (aavehelper.isAToken(destToken)) {
        destToken = aavehelper.getUnderlyingToken(destToken);
    }
    // if (compoundTokenList.includes(destToken))  如果目标token是ctoken
    

    const tmpDestToken = destToken;// 用来临时保存目标token
    const tmpInputAmounts = inputAmounts; // 用来临时保存输入金额

    const middleToken = [ADDRESS.WETH,ADDRESS.USDT]; 
    let maxReturnAmount = new BigNumber(0);
    let distribution= null;
    let path1 = null;
    let path2 = null;
    paths.push([]);
    paths.push([]);
    for(const middle of middleToken){
        const queries = [];
        const UniswapV2Factories = [ADDRESS.SushiswapFactory,ADDRESS.ShibaswapFactory,ADDRESS.UniswapV2Factory];  // 都是基于uni的v2协议 
        let uniswapv2helper = new Uniswapv2helper();
        for(let i = 0; i < UniswapV2Factories.length; i++){
            queries.push(uniswapv2helper.getOutputByExactInput(
                srcToken,
                middle,
                inputAmounts,
                UniswapV2Factories[i],
                part,
                signer
            ))
        }
    
        const uniswapv3helper = new Uniswapv3helper();
        queries.push(uniswapv3helper.getOutputByExactInput(srcToken,middle,inputAmounts,uniswapv3_fee,ADDRESS.V3QUOTE_V2,part,signer));
    
        
        queries.push(aavehelper.getOutputByExactInput(srcToken,middle,inputAmounts,ADDRESS.AAVEPOOLV2,part,signer));
        
        const dodohelper = new Dodohelper();
        queries.push(dodohelper.getOutputByExactInput(srcToken,middle,inputAmounts,null,part,signer));
        
        let matrix = [];  
    
        const partResults = await Promise.all(queries);
        for(let i = 0; i < partResults.length; i++){
            matrix.push(partResults[i]);
        }
    

        let res = findBestDistributionWithBigNumber(part, matrix);
        distribution = res.distribution;
        // 归一化distribution数组
        let distribution_count = 0;
        for(let i = 0; i < distribution.length; i++){
            distribution_count += distribution[i];
        }
        for(let i = 0; i < distribution.length; i++){
            distribution[i] = Math.round(distribution[i]/distribution_count*100);
        }        
        path1 = [srcToken, middle, 0, distribution, 0];  // 添加路径

        inputAmounts = res.returnAmount.toString();



        const queries2 = [];
        for(let i = 0; i < UniswapV2Factories.length; i++){
            queries2.push(uniswapv2helper.getOutputByExactInput(
                middle,
                destToken,
                inputAmounts,
                UniswapV2Factories[i],
                part,
                signer
            ))
        }
    
        queries2.push(uniswapv3helper.getOutputByExactInput(middle,destToken,inputAmounts,uniswapv3_fee,ADDRESS.V3QUOTE_V2,part,signer)); 
        queries2.push(aavehelper.getOutputByExactInput(middle,destToken,inputAmounts,ADDRESS.AAVEPOOLV2,part,signer));
        queries2.push(dodohelper.getOutputByExactInput(middle,destToken,inputAmounts,null,part,signer));
        
        matrix = [];      
        const partResults2 = await Promise.all(queries2);
        for(let i = 0; i < partResults2.length; i++){
            matrix.push(partResults2[i]);
        }    

        res = findBestDistributionWithBigNumber(part, matrix);

        // 归一化distribution数组
        distribution_count = 0;
        distribution = res.distribution;
        for(let i = 0; i < distribution.length; i++){
            distribution_count += distribution[i];
        }
        for(let i = 0; i < distribution.length; i++){
            distribution[i] = Math.round(distribution[i]/distribution_count*100);
        }        
        path2 = [middle, destToken, 0, distribution, 0];  // 添加路径

        if (res.returnAmount.isGreaterThan(maxReturnAmount) ){
            maxReturnAmount = res.returnAmount;
            paths[1] = path1;
            paths[2] = path2; 
        }

    }
    




    // 特殊token的转换，例如aave和compound
    destToken = tmp;
    if (aavehelper.isAToken(destToken)) {
        const address = aavehelper.getUnderlyingToken(destToken);
        paths.push([address, destToken, 0, [0, 0, 0, 0, 1,0], 2]);
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
    return {returnAmount : maxReturnAmount, distribution, paths: res};
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
        let iface = new ethers.utils.Interface(FXSWAPABI);
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
        let bestPath = await routerPath2(srcToken, destToken, inputAmounts, part);
        res.send({bestPath});
        return;

    }




});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
