const express = require('express');
const { ethers } = require('ethers');
const app = express();
const cors = require('cors');
const config = require('./config');
const Cache = require('./helpers/utils/cache');
const port = config.port;
const provider = new ethers.providers.JsonRpcProvider(config.rpc);
const wallet = new ethers.Wallet(config.privateKey, provider);
const axios = require('axios');
const signer = provider.getSigner(wallet.address);
const MAX_INT = '115792089237316195423570985008687907853269984665640564039457584007913129639934';
const BigNumber = require('bignumber.js');
const ADDRESS = require('./helpers/constant/addresses');

const FXSWAP_ABI = require('./helpers/abi/fxswap.json');
const AaveV2helper = require('./helpers/aavev2helper');
const Uniswapv3helper = require('./helpers/uniswapv3helper.js');
const Uniswapv2helper = require('./helpers/uniswapv2helper');
const Dodohelper = require('./helpers/dodohelper.js');
//const Compoundhelper = require("./helpers/compoundhelper.js");
const Util = require('./helpers/utils/util.js');

const uniswapv3_fee = 3000;
const gwei = 30;
const ethPrice = 2000;

const cache = new Cache(5);

app.use(cors());

function bitAt(num, pos) {
    return (num >> pos) & 1;
}

function uniformDistribution(distribution) {
    let distribution_count = 0;
    for (let i = 0; i < distribution.length; i++) {
        distribution_count += distribution[i];
    }
    for (let i = 0; i < distribution.length; i++) {
        distribution[i] = Math.round((distribution[i] / distribution_count) * 100);
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
    const returnAmount = answer[n - 1][s] == new BigNumber(-1e72) ? new BigNumber(0) : answer[n - 1][s];

    return { returnAmount, distribution };
}

async function getChart(tokenIn, tokenOut, days, part, currency) {
    try {
        if (tokenIn === ADDRESS.ETH) {
            tokenIn = ADDRESS.WETH;
        }
        if (tokenOut === ADDRESS.ETH) {
            tokenOut = ADDRESS.WETH;
        }

        const symbol1 = await Util.getSymbol(tokenIn, signer);
        const symbol2 = await Util.getSymbol(tokenOut, signer);
        const api_key = config.cryptocompare_apikey;
        let limit;
        let url;

        if (days === 0.5) {
            limit = 12;
            url = `https://min-api.cryptocompare.com/data/v2/histohour?fsym=${symbol1}&tsym=${symbol2}&aggregate=1&limit=${limit}&api_key=${api_key}`;
        } else if (days === 1) {
            limit = 24;
            url = `https://min-api.cryptocompare.com/data/v2/histohour?fsym=${symbol1}&tsym=${symbol2}&aggregate=1&limit=${limit}&api_key=${api_key}`;
        } else if (days === 3) {
            limit = 72;
            url = `https://min-api.cryptocompare.com/data/v2/histohour?fsym=${symbol1}&tsym=${symbol2}&aggregate=1&limit=${limit}&api_key=${api_key}`;
        } else if (days === 7) {
            limit = 7;
            url = `https://min-api.cryptocompare.com/data/v2/histoday?fsym=${symbol1}&tsym=${symbol2}&aggregate=1&limit=${limit}&api_key=${api_key}`;
        } else if (days === 30) {
            limit = 30;
            url = `https://min-api.cryptocompare.com/data/v2/histoday?fsym=${symbol1}&tsym=${symbol2}&aggregate=1&limit=${limit}&api_key=${api_key}`;
        }

        const response = await axios.get(url);
        const data = response.data.Data.Data;

        let result = {};
        result.chart = [];
        for (let i = 0; i < data.length; i++) {
            result.chart.push({
                timestamp: data[i].time,
                price: data[i].close
            });
        }

        const diff = ((data[data.length - 1].close - data[0].close) / data[0].close) * 100;
        result.diff = diff.toFixed(2);
        result.currentPrice = data[data.length - 1].close;
        return result;
    } catch (err) {
        //
        let result = {};
        result.chart = [];
        for (let i = 0; i < 30; i++) {
            result.chart.push({
                timestamp: 0,
                price: 1
            });
        }
        result.diff = 0;
        result.currentPrice = 1;
        return result;
    }
}

async function getDisplayInformation(srcToken, destToken, inputAmounts, bestPath) {
    // 返回给前端的显示信息
    if (srcToken === ADDRESS.ETH) {
        srcToken = ADDRESS.WETH;
    }

    let queries = [];
    queries.push(srcToken === ADDRESS.ETH ? 18 : Util.getDecimals(srcToken, signer));
    queries.push(destToken === ADDRESS.ETH ? 18 : Util.getDecimals(destToken, signer));
    queries.push(srcToken === ADDRESS.ETH ? 'ETH' : Util.getSymbol(srcToken, signer));
    queries.push(destToken === ADDRESS.ETH ? 'ETH' : Util.getSymbol(destToken, signer));
    let start = new Date().getTime();
    const baseResults = await Promise.all(queries);
    let end = new Date().getTime();
    console.log('base time: ' + (end - start) + 'ms');
    const inputDecimals = baseResults[0];
    const outputDecimals = baseResults[1];
    const inputSymbol = baseResults[2];
    const outputSymbol = baseResults[3];

    queries = [];
    const swaps = [
        {
            name: 'FxSwap',
            price: bestPath.returnAmount
                .dividedBy(10 ** outputDecimals)
                .dividedBy(new BigNumber(inputAmounts).dividedBy(10 ** inputDecimals)),
            youGet: bestPath.returnAmount.dividedBy(Math.pow(10, outputDecimals)),
            fees: 8.88
        }
    ];
    const UniswapV2Factories = [ADDRESS.SushiSwapFactory, ADDRESS.ShibaSwapFactory, ADDRESS.UniswapV2Factory]; // 都是基于uni的v2协议
    let uniswapv2helper = new Uniswapv2helper();
    for (let i = 0; i < UniswapV2Factories.length; i++) {
        queries.push(
            uniswapv2helper.getOutputByExactInput(srcToken, destToken, inputAmounts, UniswapV2Factories[i], 1, signer)
        );
    }

    const uniswapv3helper = new Uniswapv3helper();
    queries.push(
        uniswapv3helper.getOutputByExactInput(
            srcToken,
            destToken,
            inputAmounts,
            uniswapv3_fee,
            ADDRESS.V3QUOTE_V2,
            1,
            signer
        )
    );

    const aavev2helper = new AaveV2helper();
    queries.push(aavev2helper.getOutputByExactInput(srcToken, destToken, inputAmounts, ADDRESS.AAVEPOOLV2, 1, signer));

    const dodohelper = new Dodohelper();
    queries.push(dodohelper.getOutputByExactInput(srcToken, destToken, inputAmounts, null, 1, signer));

    //const compoundhelper = new Compoundhelper();
    //queries.push(compoundhelper.getOutputByExactInput(srcToken, destToken, inputAmounts, null, 1, signer));

    let matrix = [];
    start = new Date().getTime();
    const partResults = await Promise.all(queries);
    end = new Date().getTime();
    console.log('display time: ' + (end - start) + 'ms');
    for (let i = 0; i < partResults.length; i++) {
        matrix.push(partResults[i]);
    }

    const name_string = ['SushiSwap', 'ShibaSwap', 'UniswapV2', 'UniswapV3', 'AaveV2', 'Dodo'];
    const gas = [120000, 120000, 120000, 150000, 250000, 300000];
    for (let i = 0; i < name_string.length; i++) {
        swaps.push({
            name: name_string[i],
            price: matrix[i][1] / Math.pow(10, outputDecimals) / (inputAmounts / Math.pow(10, inputDecimals)),
            youGet: matrix[i][1] / Math.pow(10, outputDecimals),
            fees: new BigNumber(gas[i])
                .multipliedBy(gwei * 10 ** 9)
                .multipliedBy(ethPrice)
                .dividedBy(10 ** 18)
                .toString()
        });
    }

    // 构建paths对象
    const paths = [[]]; // 暂时只有一条路线

    for (let i = 0; i < bestPath.paths.length; i++) {
        let path = bestPath.paths[i].path;

        path[3] = uniformDistribution(path[3]);
        const tmp = [];
        for (let j = 0; j < path[3].length; j++) {
            if (path[3][j] > 0) {
                tmp.push({
                    name: name_string[j],
                    part: path[3][j],
                    source_token: path[0],
                    target_token: path[1]
                });
            }
        }
        paths[0].push(tmp);
    }

    const estimated_gas_list = [170000, 170000, 170000, 205000, 467688, 240000];
    let estimated_gas_total = 0;
    // 遍历paths[0]
    for (let i = 0; i < paths[0].length; i++) {
        for (let j = 0; j < paths[0][i].length; j++) {
            const inx = name_string.indexOf(paths[0][i][j].name);
            if (inx === -1) {
                //name_string无法匹配
                continue;
            }
            estimated_gas_total += estimated_gas_list[inx];
        }
    }
    swaps[0].fees = new BigNumber(estimated_gas_total)
        .multipliedBy(gwei * 10 ** 9)
        .multipliedBy(ethPrice)
        .dividedBy(10 ** 18)
        .toString(); //更新FxSwap的手续费

    // 计算价格冲击
    start = new Date().getTime();
    const inputPrice = getPrice(
        inputSymbol,
        new BigNumber(inputAmounts).dividedBy(10 ** inputDecimals).toString(),
        signer
    );
    const outputPrice = getPrice(
        outputSymbol,
        bestPath.returnAmount.dividedBy(10 ** outputDecimals).toString(),
        signer
    );
    const price_impact_queries = [];
    price_impact_queries.push(inputPrice);
    price_impact_queries.push(outputPrice);
    const price_impact_result = await Promise.all(price_impact_queries);
    const price_impact = price_impact_result[0]
        .minus(price_impact_result[1])
        .dividedBy(price_impact_result[0])
        .multipliedBy(100)
        .toFixed(2);
    end = new Date().getTime();
    console.log('price_impact: ' + (end - start) + 'ms');

    const result = {
        source_token: srcToken,
        target_token: destToken,
        source_token_amount: inputAmounts,
        target_token_amount: bestPath.returnAmount.toString(),
        inputDecimals: inputDecimals,
        outputDecimals: outputDecimals,
        paths: paths,
        swaps: swaps,
        price_impact: price_impact
    };

    return result;
}

async function buildTrades(paths) {
    // 路由具体逻辑的构造
    const abiEncoder = new ethers.utils.AbiCoder();
    const trades = [];
    for (let i = 0; i < paths.length; i++) {
        const sourceToken = paths[i][0];
        const destinationToken = paths[i][1];
        const amount = 0; //paths[i][2];  amount全为0，仅根据distribution来获得
        const path = paths[i];
        const _distribution = paths[i][3];
        const distribution = [];
        const orders = [];
        if (_distribution[0] > 0) {
            // sushiSwap
            distribution.push(_distribution[0]);
            const encodedPayload = abiEncoder.encode(
                ['address', 'address', 'address', 'uint256', 'uint256', 'uint256'],
                [ADDRESS.SUSHI_ROUTER, sourceToken, destinationToken, amount, MAX_INT, 0]
            );
            orders.push({
                exchangeHandler: config.uniswapV2Handler_ADDRESS, // orders经由部署 UniswapV2Handler合约进行处理
                encodedPayload: encodedPayload
            });
        }
        if (_distribution[1] > 0) {
            // shibaSwap
            distribution.push(_distribution[1]);
            const encodedPayload = abiEncoder.encode(
                ['address', 'address', 'address', 'uint256', 'uint256', 'uint256'],
                [ADDRESS.SHIBA_ROUTER, sourceToken, destinationToken, amount, MAX_INT, 0]
            );
            orders.push({
                exchangeHandler: config.uniswapV2Handler_ADDRESS, // orders经由部署 UniswapV2Handler合约进行处理
                encodedPayload: encodedPayload
            });
        }
        if (_distribution[2] > 0) {
            // uniswapv2
            distribution.push(_distribution[2]);
            const encodedPayload = abiEncoder.encode(
                ['address', 'address', 'address', 'uint256', 'uint256', 'uint256'],
                [ADDRESS.UNISWAP_ROUTER, sourceToken, destinationToken, amount, MAX_INT, 0]
            );
            orders.push({
                exchangeHandler: config.uniswapV2Handler_ADDRESS, // orders经由部署 UniswapV2Handler合约进行处理
                encodedPayload: encodedPayload
            });
        }
        if (_distribution[3] > 0) {
            // uniswapv3
            distribution.push(_distribution[3]);
            const encodedPayload = abiEncoder.encode(
                ['address', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint24', 'uint160'],
                [ADDRESS.UNISWAPV3_ROUTER, sourceToken, destinationToken, amount, MAX_INT, 0, uniswapv3_fee, 0] // 默认0.3%手续费
            );
            orders.push({
                exchangeHandler: config.uniswapV3Handler_ADDRESS, // orders经由部署 UniswapV3Handler合约进行处理
                encodedPayload: encodedPayload
            });
        }
        if (_distribution[4] > 0) {
            // aave
            distribution.push(_distribution[4]);
            const aavev2helper = new AaveV2helper();
            const encodedPayload = abiEncoder.encode(
                ['address', 'address', 'uint256', 'uint256'],
                [sourceToken, destinationToken, amount, aavev2helper.isAToken(sourceToken) ? 1 : 2]
            );
            orders.push({
                exchangeHandler: config.aaveV2Handler_ADDRESS, // orders经由部署 aaveV2Handler合约进行处理
                encodedPayload: encodedPayload
            });
        }
        if (_distribution[5] > 0) {
            // dodo
            distribution.push(_distribution[5]);
            const dodohelper = new Dodohelper();
            const { pool, tokenInIsBase, version } = await dodohelper.tokenInfo(sourceToken, destinationToken, signer);
            const encodedPayload = abiEncoder.encode(
                ['address', 'address', 'address', 'uint256', 'uint256', 'bool', 'address'],
                [sourceToken, destinationToken, pool, amount, version, tokenInIsBase, ADDRESS.DODO_HELPER]
            );
            orders.push({
                exchangeHandler: config.dodoHandler_ADDRESS, // orders经由部署 aaveV2Handler合约进行处理
                encodedPayload: encodedPayload
            });
        }
        // if (_distribution[6] > 0) { // compound
        //     distribution.push(_distribution[6]);
        //     const compoundhelper = new Compoundhelper();
        //     const encodedPayload = abiEncoder.encode(["address", "address", "uint256", "uint256"],
        //         [sourceToken, destinationToken, amount, compoundhelper.isCToken(sourceToken) ? 1 : 2]
        //     )
        //     orders.push(
        //         {
        //             "exchangeHandler": config.compoundHandler_ADDRESS, // orders经由部署 compoundHandler 合约进行处理
        //             "encodedPayload": encodedPayload
        //         }
        //     )
        // }
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

async function routerPath(srcToken, destToken, inputAmounts, part, flag, depth) {
    // dex顺序 [sushiSwap,shibaSwap,uniswapv2,uniswapv3,aave,dodo，compound]

    const paths = [];

    // 先做第一层转换，例如aave和compound, 都是Defi的token与对应token的转换
    const aavev2helper = new AaveV2helper();
    if (aavev2helper.isAToken(srcToken)) {
        if (bitAt(flag, 4) == 0) {
            return { returnAmount: 0, distribution: [0, 0, 0, 0, 0, 0], paths: [] }; // 如果初始token是atoken且没有激活aave协议，则不能进行swap
        }
        const UNDERLYING_ASSET_ADDRESS = aavev2helper.getUnderlyingToken(srcToken);
        paths.push({
            returnAmount: inputAmounts,
            path: [srcToken, UNDERLYING_ASSET_ADDRESS, inputAmounts, [0, 0, 0, 0, 1, 0], 1]
        }); // 最后的1代表aave的deposit
        srcToken = UNDERLYING_ASSET_ADDRESS;
    }
    // const compoundhelper = new Compoundhelper();
    // if (compoundhelper.isCToken(srcToken)) {   // 如果源token是ctoken
    //     if (bitAt(flag, 6) == 0) {
    //         return { returnAmount: 0, distribution: [0, 0, 0, 0, 0, 0, 0], paths: [] };
    //     }
    //     const UNDERLYING_ASSET_ADDRESS = compoundhelper.getUnderlyingToken(srcToken);
    //     paths.push({ returnAmount: inputAmounts, path: [srcToken, UNDERLYING_ASSET_ADDRESS, inputAmounts, [0, 0, 0, 0, 0, 0, 1], 1] });
    //     srcToken = UNDERLYING_ASSET_ADDRESS;
    // }
    // inputAmounts = inputAmounts; //第一层转换后更新inputAmounts

    let tmp = destToken;
    // 最后一层转换
    if (aavev2helper.isAToken(destToken)) {
        destToken = aavev2helper.getUnderlyingToken(destToken);
    }
    // if (compoundhelper.isCToken(srcToken))   如果目标token是ctoken

    const queries = []; // 查询队列
    let uniswapv2helper = new Uniswapv2helper(); // 都是基于uni的v2协议
    bitAt(flag, 0) == 1
        ? queries.push(
              uniswapv2helper.getOutputByExactInput(
                  srcToken,
                  destToken,
                  inputAmounts,
                  ADDRESS.SushiSwapFactory,
                  part,
                  signer
              )
          )
        : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));
    bitAt(flag, 1) == 1
        ? queries.push(
              uniswapv2helper.getOutputByExactInput(
                  srcToken,
                  destToken,
                  inputAmounts,
                  ADDRESS.ShibaSwapFactory,
                  part,
                  signer
              )
          )
        : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));
    bitAt(flag, 2) == 1
        ? queries.push(
              uniswapv2helper.getOutputByExactInput(
                  srcToken,
                  destToken,
                  inputAmounts,
                  ADDRESS.UniswapV2Factory,
                  part,
                  signer
              )
          )
        : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));

    const uniswapv3helper = new Uniswapv3helper();
    bitAt(flag, 3) == 1
        ? queries.push(
              uniswapv3helper.getOutputByExactInput(
                  srcToken,
                  destToken,
                  inputAmounts,
                  uniswapv3_fee,
                  ADDRESS.V3QUOTE_V2,
                  part,
                  signer
              )
          )
        : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));

    bitAt(flag, 4) == 1
        ? queries.push(
              aavev2helper.getOutputByExactInput(srcToken, destToken, inputAmounts, ADDRESS.AAVEPOOLV2, part, signer)
          )
        : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));

    const dodohelper = new Dodohelper();
    bitAt(flag, 5) == 1
        ? queries.push(dodohelper.getOutputByExactInput(srcToken, destToken, inputAmounts, null, part, signer))
        : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));

    let returnAmount = 0;
    let distribution = null;
    if (depth == 1) {
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
        const res = findBestDistributionWithBigNumber(part, matrix);
        returnAmount = res.returnAmount;
        distribution = res.distribution;

        // 归一化distribution数组
        distribution = uniformDistribution(distribution);

        console.log(returnAmount, distribution);
        paths.push({ returnAmount: returnAmount, path: [srcToken, destToken, 0, distribution, 0] }); // 添加路径
    } else if (depth == 2) {
        const middleToken = [ADDRESS.WETH, ADDRESS.USDT, ADDRESS.WBTC, ADDRESS.USDC, ADDRESS.DAI];

        const queries = [];
        for (const middle of middleToken) {
            queries.push(_queryBetweenInputAndOutputWithMiddle(srcToken, middle, destToken, inputAmounts, part, flag));
        }
        const queryResults = await Promise.all(queries);
        let maxIndex = 0;
        let maxReturnAmount = new BigNumber(0);
        for (let i = 0; i < queryResults.length; i++) {
            if (new BigNumber(queryResults[i].returnAmount).isGreaterThan(maxReturnAmount)) {
                maxReturnAmount = queryResults[i].returnAmount;
                maxIndex = i;
            }
        }
        for (let i = 0; i < queryResults[maxIndex].paths.length; i++) {
            paths.push(queryResults[maxIndex].paths[i]);
        }
        returnAmount = new BigNumber(queryResults[maxIndex].returnAmount);
    }

    // 特殊token的转换，例如aave和compound
    destToken = tmp;
    if (aavev2helper.isAToken(destToken)) {
        if (bitAt(flag, 4) == 0) {
            return { returnAmount: 0, distribution: [0, 0, 0, 0, 0, 0], paths: [] }; // 不能进行swap
        }
        const address = aavev2helper.getUnderlyingToken(destToken);
        paths.push({ returnAmount: returnAmount, path: [address, destToken, 0, [0, 0, 0, 0, 1, 0], 2] });
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
    return { returnAmount, paths };
}

async function _queryBetweenInputAndOutput(srcToken, destToken, inputAmounts, part, flag) {
    const aavev2helper = new AaveV2helper();
    const uniswapv2helper = new Uniswapv2helper();
    const uniswapv3helper = new Uniswapv3helper();
    const dodohelper = new Dodohelper();
    //const compoundhelper = new Compoundhelper();
    const queries = []; // 查询队列
    bitAt(flag, 0) == 1
        ? queries.push(
              uniswapv2helper.getOutputByExactInput(
                  srcToken,
                  destToken,
                  inputAmounts,
                  ADDRESS.SushiSwapFactory,
                  part,
                  signer
              )
          )
        : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));
    bitAt(flag, 1) == 1
        ? queries.push(
              uniswapv2helper.getOutputByExactInput(
                  srcToken,
                  destToken,
                  inputAmounts,
                  ADDRESS.ShibaSwapFactory,
                  part,
                  signer
              )
          )
        : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));
    bitAt(flag, 2) == 1
        ? queries.push(
              uniswapv2helper.getOutputByExactInput(
                  srcToken,
                  destToken,
                  inputAmounts,
                  ADDRESS.UniswapV2Factory,
                  part,
                  signer
              )
          )
        : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));
    bitAt(flag, 3) == 1
        ? queries.push(
              uniswapv3helper.getOutputByExactInput(
                  srcToken,
                  destToken,
                  inputAmounts,
                  uniswapv3_fee,
                  ADDRESS.V3QUOTE_V2,
                  part,
                  signer
              )
          )
        : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));
    bitAt(flag, 4) == 1
        ? queries.push(
              aavev2helper.getOutputByExactInput(srcToken, destToken, inputAmounts, ADDRESS.AAVEPOOLV2, part, signer)
          )
        : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));
    bitAt(flag, 5) == 1
        ? queries.push(dodohelper.getOutputByExactInput(srcToken, destToken, inputAmounts, null, part, signer))
        : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));
    // bitAt(flag, 6) == 1 ? queries.push(compoundhelper.getOutputByExactInput(srcToken, destToken, inputAmounts, null, part, signer)) : queries.push(new Array(Number(part) + 1).fill(new BigNumber(0)));
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
        distribution[i] = Math.round((distribution[i] / distribution_count) * 100);
    }
    path = [srcToken, destToken, 0, distribution, 0];

    return { returnAmount: returnAmount.toString(), path };
}

async function _queryBetweenInputAndOutputWithMiddle(srcToken, middle, destToken, inputAmounts, part, flag) {
    const res1 = await _queryBetweenInputAndOutput(srcToken, middle, inputAmounts, part, flag);
    const res2 = await _queryBetweenInputAndOutput(middle, destToken, res1.returnAmount, part, flag);
    return { returnAmount: res2.returnAmount, paths: [res1, res2] };
}

async function getPrice(token, amount) {
    try {
        const result = await axios.get('https://service.price.dxpool.com:3001/price', {
            params: {
                symbol: token
            }
        });
        return new BigNumber(amount).multipliedBy(result.data.data.price.CNY[token]);
    } catch (err) {
        return new BigNumber(0);
    }
}

app.get('/', (req, res) => {
    res.send('Hello FxSwap!');
});

app.get('/quote', async (req, res) => {
    const start = new Date().getTime();

    try {
        const srcToken = req.query.source_token; // 源token
        const destToken = req.query.target_token; // 目标token
        const inputAmounts = req.query.amount; // 源token数量
        const part = Number(req.query.part) > 50 ? 50 : Number(req.query.part); // 分成几份进行计算
        const slippage = isNaN(Number(req.query.slippage)) ? 5 : Number(req.query.slippage) * 10; // 滑点
        const senderAddress = req.query.sender_address; // 用户地址
        const receiverAddress = req.query.receiver_address;
        const depth = isNaN(Number(req.query.depth)) ? 0 : Number(req.query.depth); // 搜索深度
        const flag = isNaN(Number(req.query.flag)) ? 2 ** 52 - 1 : Number(req.query.flag); // dex筛选位

        const data = cache.get(
            `quote:${srcToken}:${destToken}:${inputAmounts}:${part}:${slippage}:${senderAddress}:${receiverAddress}:${depth}:${flag}`
        );
        if (data) {
            res.send(data);
            console.log('命中缓存');
            return;
        }

        let result = {};

        let start = new Date().getTime();
        let bestPath = null;
        if (depth === 0) {
            const bestPaths = await Promise.all([
                routerPath(srcToken, destToken, inputAmounts, part, flag, 1),
                routerPath(srcToken, destToken, inputAmounts, part, flag, 2)
            ]); //  depth代表除头尾的特殊转换（aave和compound）中间的遍历深度， 例如 adai => dai => usdt => usdc =>audc， depth=2
            bestPath = bestPaths[0].returnAmount.isGreaterThan(bestPaths[1].returnAmount) ? bestPaths[0] : bestPaths[1];
        } else {
            bestPath = await routerPath(srcToken, destToken, inputAmounts, part, flag, depth);
        }

        let end = new Date().getTime();
        console.log('寻找路径耗时: ' + (end - start) + 'ms');

        let display = await getDisplayInformation(srcToken, destToken, inputAmounts, bestPath);
        let end2 = new Date().getTime();
        console.log('获取展示信息耗时: ' + (end2 - end) + 'ms');

        const minimumReceived = new BigNumber(display.swaps[0].youGet.toFixed(6))
            .multipliedBy(1000 - slippage)
            .dividedBy(1000);
        result.source_token = srcToken;
        result.target_token = destToken;
        result.source_token_amount = inputAmounts;
        result.target_token_amount = display.target_token_amount;
        result.swaps = display.swaps;
        result.paths = display.paths;
        result.minimumReceived = minimumReceived.toString();
        result.estimate_gas = -1;
        result.estimate_cost = display.swaps[0].fees;
        result.reception = new BigNumber(display.target_token_amount).dividedBy(10 ** display.outputDecimals);
        result.minimum_reception = minimumReceived.dividedBy(10 ** display.outputDecimals);
        result.price_impact = display.price_impact;

        const paths = [];
        for (let i = 0; i < bestPath.paths.length; i++) {
            paths.push(bestPath.paths[i].path);
        }

        const trades = await buildTrades(paths);
        let iface = new ethers.utils.Interface(FXSWAP_ABI);
        const txData = iface.encodeFunctionData('performSwapCollection', [
            {
                swaps: [
                    {
                        trades: trades // 只支持一条路径
                    }
                ]
            },
            srcToken,
            destToken,
            inputAmounts,
            minimumReceived.toFixed(0)
        ]);
        result.tx_data = txData;
        res.send(result);
        cache.set(
            `quote:${srcToken}:${destToken}:${inputAmounts}:${part}:${slippage}:${senderAddress}:${receiverAddress}:${depth}:${flag}`,
            result
        );
    } catch (err) {
        console.log(err);
        res.send(err);
    }

    const end = new Date().getTime();
    console.log('总耗时: ' + (end - start) + 'ms');
});

app.get('/chart', async (req, res) => {
    const start = new Date().getTime();

    try {
        const srcToken = req.query.source_token; // 源token
        const destToken = req.query.target_token; // 目标token
        const part = Number(req.query.part) > 100 ? 100 : Number(req.query.part); // 分成几份进行计算
        const days = isNaN(Number(req.query.days)) ? 30 : Number(req.query.days); // 分成几份进行计算
        const currency = 'USD';
        const result = await getChart(srcToken, destToken, days, part, currency);
        res.send(result);
    } catch (err) {
        console.log(err);
        res.send(err);
    }

    const end = new Date().getTime();
    console.log('图标总耗时: ' + (end - start) + 'ms');
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});

const fs = require('fs');
try {
    const privateKey = fs.readFileSync('./https/privkey.pem', 'utf8');
    const certificate = fs.readFileSync('./https/cert.pem', 'utf8');
    const credentials = { key: privateKey, cert: certificate };
    const SSLPORT = 8546;
    const https = require('https');
    const httpsServer = https.createServer(credentials, app);
    httpsServer.listen(SSLPORT, function () {
        console.log('HTTPS Server is running on: https://localhost:%s', SSLPORT);
    });
} catch (err) {
    console.log(err);
}
