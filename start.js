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
const dex_info = {
    dex: ['SushiSwap', 'ShibaSwap', 'UniswapV2', 'UniswapV3', 'AaveV2', 'Dodo'],
    gas: [120000, 120000, 120000, 150000, 250000, 300000],
    estimate_cost: [170000, 170000, 170000, 205000, 467688, 240000]
};

const cache = new Cache(5);

app.use(cors());

function bitAt(num, pos) {
    return (num >> pos) & 1;
}

const BN = Util.BN; // 大整数转换

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
            answer[i][j] = BN(-1e72);
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
    const returnAmount = answer[n - 1][s] == BN(-1e72) ? BN(0) : answer[n - 1][s];

    return { returnAmount, distribution };
}

async function getChart(tokenIn, tokenOut, days) {
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

async function getDisplayInformation(srcToken, destToken, inputAmounts, bestPath, flag) {
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
    const returnAmount = BN(bestPath.returnAmount);
    const swaps = [
        {
            name: 'FxSwap',
            price: returnAmount
                .dividedBy(10 ** outputDecimals)
                .dividedBy(BN(inputAmounts).dividedBy(10 ** inputDecimals)),
            youGet: returnAmount.dividedBy(Math.pow(10, outputDecimals)),
            fees: 0
        }
    ];
    const aavev2helper = new AaveV2helper();
    const uniswapv2helper = new Uniswapv2helper();
    const uniswapv3helper = new Uniswapv3helper();
    const dodohelper = new Dodohelper();
    //const compoundhelper = new Compoundhelper();
    queries = []; // 查询队列
    if (bitAt(flag, 0) == 1) {
        queries.push(
            uniswapv2helper.getOutputByExactInput(
                srcToken,
                destToken,
                inputAmounts,
                ADDRESS.SushiSwapFactory,
                1,
                signer
            )
        );
    }
    if (bitAt(flag, 1) == 1) {
        queries.push(
            uniswapv2helper.getOutputByExactInput(
                srcToken,
                destToken,
                inputAmounts,
                ADDRESS.ShibaSwapFactory,
                1,
                signer
            )
        );
    }
    if (bitAt(flag, 2) == 1) {
        queries.push(
            uniswapv2helper.getOutputByExactInput(
                srcToken,
                destToken,
                inputAmounts,
                ADDRESS.UniswapV2Factory,
                1,
                signer
            )
        );
    }
    if (bitAt(flag, 3) == 1) {
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
    }
    if (bitAt(flag, 4) == 1) {
        queries.push(
            aavev2helper.getOutputByExactInput(srcToken, destToken, inputAmounts, ADDRESS.AAVEPOOLV2, 1, signer)
        );
    }
    if (bitAt(flag, 5) == 1) {
        queries.push(dodohelper.getOutputByExactInput(srcToken, destToken, inputAmounts, null, 1, signer));
    }
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

    let name_string = dex_info.dex;

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

    name_string = [];
    for (let i = 0; i < dex_info.dex.length; i++) {
        if (bitAt(flag, i) == 1) {
            name_string.push(dex_info.dex[i]);
        }
    }
    const gas = dex_info.gas;
    for (let i = 0; i < name_string.length; i++) {
        swaps.push({
            name: name_string[i],
            price: matrix[i][1] / Math.pow(10, outputDecimals) / (inputAmounts / Math.pow(10, inputDecimals)),
            youGet: matrix[i][1] / Math.pow(10, outputDecimals),
            fees: BN(gas[i])
                .multipliedBy(gwei * 10 ** 9)
                .multipliedBy(ethPrice)
                .dividedBy(10 ** 18)
                .toString()
        });
    }

    const estimated_gas_list = dex_info.estimate_cost;
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
    swaps[0].fees = BN(estimated_gas_total)
        .multipliedBy(gwei * 10 ** 9)
        .multipliedBy(ethPrice)
        .dividedBy(10 ** 18)
        .toString(); //更新FxSwap的手续费

    // 计算价格冲击
    start = new Date().getTime();
    const inputPrice = getPrice(
        inputSymbol,
        BN(inputAmounts)
            .dividedBy(10 ** inputDecimals)
            .toString(),
        signer
    );
    const outputPrice = getPrice(outputSymbol, returnAmount.dividedBy(10 ** outputDecimals).toString(), signer);
    const price_impact_queries = [];
    price_impact_queries.push(inputPrice);
    price_impact_queries.push(outputPrice);
    const price_impact_result = await Promise.all(price_impact_queries);
    let price_impact = price_impact_result[0]
        .minus(price_impact_result[1])
        .dividedBy(price_impact_result[0])
        .multipliedBy(100)
        .toFixed(2);
    if (isNaN(price_impact)) {
        price_impact = 0;
    }
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
        price_impact: price_impact,
        estimate_gas: estimated_gas_total
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

    let returnAmount = 0;
    if (depth == 1) {
        const result = await _queryBetweenInputAndOutput(srcToken, destToken, inputAmounts, part, flag);
        returnAmount = result.returnAmount;
        console.log(result.returnAmount, result.path);
        paths.push({ returnAmount, path: result.path }); // 添加路径
    } else if (depth == 2) {
        const middleToken = [ADDRESS.WETH, ADDRESS.USDT, ADDRESS.USDC];
        const queries = [];
        for (const middle of middleToken) {
            queries.push(_queryBetweenInputAndOutputWithMiddle(srcToken, middle, destToken, inputAmounts, part, flag));
        }
        const queryResults = await Promise.all(queries);
        let maxIndex = 0;
        let maxReturnAmount = BN(0);
        for (let i = 0; i < queryResults.length; i++) {
            if (BN(queryResults[i].returnAmount).isGreaterThan(maxReturnAmount)) {
                maxReturnAmount = queryResults[i].returnAmount;
                maxIndex = i;
            }
        }
        for (let i = 0; i < queryResults[maxIndex].paths.length; i++) {
            paths.push(queryResults[maxIndex].paths[i]);
        }
        returnAmount = BN(queryResults[maxIndex].returnAmount);
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
        : queries.push(new Array(Number(part) + 1).fill(BN(0)));
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
        : queries.push(new Array(Number(part) + 1).fill(BN(0)));
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
        : queries.push(new Array(Number(part) + 1).fill(BN(0)));
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
        : queries.push(new Array(Number(part) + 1).fill(BN(0)));
    bitAt(flag, 4) == 1
        ? queries.push(
              aavev2helper.getOutputByExactInput(srcToken, destToken, inputAmounts, ADDRESS.AAVEPOOLV2, part, signer)
          )
        : queries.push(new Array(Number(part) + 1).fill(BN(0)));
    bitAt(flag, 5) == 1
        ? queries.push(dodohelper.getOutputByExactInput(srcToken, destToken, inputAmounts, null, part, signer))
        : queries.push(new Array(Number(part) + 1).fill(BN(0)));
    // bitAt(flag, 6) == 1 ? queries.push(compoundhelper.getOutputByExactInput(srcToken, destToken, inputAmounts, null, part, signer)) : queries.push(new Array(Number(part) + 1).fill(BN(0)));
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
    const middle_res = await _queryBetweenInputAndOutput(srcToken, middle, inputAmounts, part, flag);
    const dest_res = await _queryBetweenInputAndOutput(middle, destToken, middle_res.returnAmount, part, flag);
    return { returnAmount: dest_res.returnAmount, paths: [middle_res, dest_res] };
}

async function getPrice(token, amount) {
    try {
        const result = await axios.get(`https://min-api.cryptocompare.com/data/price`, {
            params: {
                fsym: token,
                tsyms: 'USD',
                api_key: config.cryptocompare_apikey
            }
        });
        return BN(amount).multipliedBy(result.data.USD);
    } catch (err) {
        console.log(err);
        return BN(0);
    }
}

function nullResult() {
    let result = {};
    result.source_token = ADDRESS.NULL;
    result.target_token = ADDRESS.NULL;
    result.source_token_amount = '0';
    result.target_token_amount = '0';
    result.swaps = [];
    result.paths = [];
    result.minimumReceived = '0';
    result.estimate_gas = '0';
    result.estimate_cost = '0';
    result.reception = '0';
    result.minimum_reception = '0';
    result.price_impact = '0';
    return result;
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

        if (Number(inputAmounts) <= 0) {
            throw 'invalid inputAmounts';
        }

        if (srcToken === destToken) {
            throw 'source_token should not same as target_token';
        }

        let result = {};
        let start = new Date().getTime();
        let bestPath = null;
        if (depth === 0) {
            const bestPaths = await Promise.all([
                routerPath(srcToken, destToken, inputAmounts, part, flag, 1),
                routerPath(srcToken, destToken, inputAmounts, part, flag, 2)
            ]); //  depth代表除头尾的特殊转换（aave和compound）中间的遍历深度， 例如 adai => dai => usdt => usdc =>audc， depth=2
            bestPath = BN(bestPaths[0].returnAmount).isGreaterThan(bestPaths[1].returnAmount)
                ? bestPaths[0]
                : bestPaths[1];
        } else {
            bestPath = await routerPath(srcToken, destToken, inputAmounts, part, flag, depth);
        }

        let end = new Date().getTime();
        console.log('寻找路径耗时: ' + (end - start) + 'ms');

        let display = await getDisplayInformation(srcToken, destToken, inputAmounts, bestPath, flag);
        let end2 = new Date().getTime();
        console.log('获取展示信息耗时: ' + (end2 - end) + 'ms');

        const minimumReceived = BN(display.swaps[0].youGet.toFixed(6))
            .multipliedBy(1000 - slippage)
            .dividedBy(1000);
        result.source_token = srcToken;
        result.target_token = destToken;
        result.source_token_amount = inputAmounts;
        result.target_token_amount = display.target_token_amount;
        result.swaps = display.swaps;
        result.paths = display.paths;
        result.minimumReceived = minimumReceived.toString();
        result.estimate_gas = display.estimate_gas;
        result.estimate_cost = display.swaps[0].fees;
        result.reception = BN(display.target_token_amount).dividedBy(10 ** display.outputDecimals);
        result.minimum_reception = minimumReceived.toString();
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
        const part = Number(req.query.part) > 100 ? 100 : Number(req.query.part);
        const days = isNaN(Number(req.query.days)) ? 30 : Number(req.query.days); // 日期
        const result = await getChart(srcToken, destToken, days);
        res.send(result);
    } catch (err) {
        console.log(err);
        res.send(err);
    }
    const end = new Date().getTime();
    console.log('图标查询总耗时: ' + (end - start) + 'ms');
});

app.get('/source', async (req, res) => {
    const chainId = isNaN(Number(req.query.chainId)) ? Number(req.query.chainId) : 1;
    if (chainId === 1) {
        res.send(dex_info.dex);
    }
    res.send('unsupported chain');
});

app.get('/tokenList', async (req, res) => {
    const data = cache.get(`tokenList:${Number(req.query.chainId)}`);
    if (data) {
        res.send(data);
    }
    const chainId = isNaN(Number(req.query.chainId)) ? 1 : Number(req.query.chainId);
    const result = await tokenList(chainId);
    cache.set(`tokenList:${Number(req.query.chainId)}`, result);
    res.send(result);
});

async function tokenList(chainId) {
    let result = {};
    result.tokenList = [];
    result.recommend = [];
    let fetchList = [];
    try {
        switch (chainId) {
            case 1: {
                result.tokenList.push({
                    chainId: chainId,
                    address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                    name: 'Ethereum',
                    symbol: 'ETH',
                    decimals: 18,
                    logoURI: config.tokenList.eth.logo_url
                });
                fetchList = (await axios.get(config.tokenList.eth.tokenList_url)).data.tokens;
                break;
            }
            case 56: {
                result.tokenList.push({
                    chainId: chainId,
                    address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                    name: 'bnb',
                    symbol: 'BNB',
                    decimals: 18,
                    logoURI: config.tokenList.bnb.logo_url
                });
                fetchList = (await axios.get(config.tokenList.bnb.tokenList_url)).data.tokens;
                break;
            }
            case 137: {
                result.tokenList.push({
                    chainId: chainId,
                    address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                    name: 'polygon',
                    symbol: 'MATIC',
                    decimals: 18,
                    logoURI: config.tokenList.polygon.logo_url
                });
                fetchList = (await axios.get(config.tokenList.polygon.tokenList_url)).data.tokens;
                break;
            }
            case 43114: {
                result.tokenList.push({
                    chainId: chainId,
                    address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                    name: 'Avalanche',
                    symbol: 'AVAX',
                    decimals: 18,
                    logoURI: config.tokenList.avalanche.logo_url
                });
                fetchList = (await axios.get(config.tokenList.avalanche.tokenList_url)).data.tokens;
                break;
            }
            case 250: {
                result.tokenList.push({
                    chainId: chainId,
                    address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                    name: 'Fantom',
                    symbol: 'FTM',
                    decimals: 18,
                    logoURI: config.tokenList.fantom.logo_url
                });
                fetchList = (await axios.get(config.tokenList.fantom.tokenList_url)).data.tokens;
                break;
            }
            case 10: {
                result.tokenList.push({
                    chainId: chainId,
                    address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                    name: 'Optimism',
                    symbol: 'OP',
                    decimals: 18,
                    logoURI: config.tokenList.optimism.logo_url
                });
                fetchList = (await axios.get(config.tokenList.optimism.tokenList_url)).data.tokens;
                break;
            }
            case 42161: {
                result.tokenList.push({
                    chainId: chainId,
                    address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                    name: 'Arbitrum',
                    symbol: 'ETH',
                    decimals: 18,
                    logoURI: config.tokenList.arbitrum.logo_url
                });
                fetchList = (await axios.get(config.tokenList.arbitrum.tokenList_url)).data.tokens;
                break;
            }
        }
        result.tokenList.push(...fetchList);
        result.tokenList.forEach((item) => {
            if (config.tokenList.eth.recommend.includes(item.symbol)) {
                result.recommend.push(item);
            }
        });
    } catch (err) {
        console.log(err);
    }

    return result;
}

function swapAPIEndpoints_0x(chainId) {
    switch (chainId) {
        case 1:
            return 'https://api.0x.org';
        case 5:
            return 'https://goerli.api.0x.org';
        case 56:
            return 'https://bsc.api.0x.org';
        case 137:
            return 'https://polygon.api.0x.org';
        case 43114:
            return 'https://avalanche.api.0x.org';
        case 250:
            return 'https://fantom.api.0x.org';
        case 10:
            return 'https://optimism.api.0x.org';
        case 42161:
            return 'https://arbitrum.api.0x.org';
        default:
            return '';
    }
}

app.get('/source_0x', async (req, res) => {
    const chainId = isNaN(Number(req.query.chainId)) ? 1 : Number(req.query.chainId);
    const swapAPIEndpoints_prefix = swapAPIEndpoints_0x(chainId);
    if (swapAPIEndpoints_prefix === '') {
        res.send('unsupported chain');
    }
    const list = await axios.get(`${swapAPIEndpoints_prefix}/swap/v1/sources`);
    res.send(list.data.records);
});

app.get('/quote_0x', async (req, res) => {
    try {
        const srcToken = req.query.source_token; // 源token
        const destToken = req.query.target_token; // 目标token
        const inputAmounts = req.query.amount; // 源token数量
        const side = req.query.side ? String(req.query.side) : 'SELL';
        const slippage = isNaN(Number(req.query.slippage)) ? 0.03 : Number(req.query.slippage) / 1000; // 滑点
        const senderAddress = req.query.sender_address; // 用户地址
        const protocols = req.query.protocols;
        const chainId = isNaN(Number(req.query.chainId)) ? 1 : Number(req.query.chainId);
        const swapAPIEndpoints_prefix = swapAPIEndpoints_0x(chainId);
        if (swapAPIEndpoints_prefix === '') {
            res.send('unsupported chain');
        }
        if (Number(inputAmounts) <= 0) {
            throw 'invalid inputAmounts';
        }

        if (srcToken === destToken) {
            throw 'source_token should not same as target_token';
        }
        const quoteCache = cache.get(
            `quote_0x:${srcToken}:${destToken}:${inputAmounts}:${side}:${slippage}:${senderAddress}:${protocols}:${chainId}`
        );
        if (quoteCache) {
            res.send(quoteCache);
            console.log('命中缓存');
            return;
        }

        let params = {};
        params.sellToken = srcToken;
        params.buyToken = destToken;
        side === 'SELL' ? (params.sellAmount = inputAmounts) : (params.buyAmount = inputAmounts);
        params.slippagePercentage = slippage;
        params.affiliateAddress = wallet.address;
        if (protocols) {
            const result = [];
            const list = (await axios.get(`${swapAPIEndpoints_prefix}/swap/v1/sources`)).data.records;
            const words = protocols.split(',');
            list.forEach((item) => {
                if (!words.includes(item)) {
                    result.push(item);
                }
            });
            params.excludedSources = result.join(',');
        }

        const data = (
            await axios.get(`${swapAPIEndpoints_prefix}/swap/v1/quote`, {
                params,
                headers: {
                    '0x-api-key': config['0x_apikey']
                }
            })
        ).data;
        let result = {};
        result.source_token = srcToken;
        result.target_token = destToken;
        result.source_token_amount = inputAmounts;
        result.target_token_amount = side === 'SELL' ? data.buyAmount : data.sellAmount;
        result.minimumReceived =
            side === 'SELL'
                ? BN(data.buyAmount)
                      .multipliedBy(1 - slippage)
                      .toString()
                : BN(data.sellAmount)
                      .multipliedBy(1 - slippage)
                      .toString();
        result.estimate_gas = data.estimatedGas;
        const ethPrice = await getPrice('ETH', 1);
        result.estimate_cost = BN(data.estimatedGas)
            .multipliedBy(data.gasPrice)
            .multipliedBy(ethPrice)
            .dividedBy(10 ** 18)
            .toString();
        const outputDecimals =
            side === 'SELL'
                ? destToken === ADDRESS.ETH
                    ? 18
                    : await Util.getDecimals(destToken, signer)
                : srcToken === ADDRESS.ETH
                ? 18
                : await Util.getDecimals(srcToken, signer);
        result.reception = BN(result.target_token_amount).dividedBy(10 ** outputDecimals);
        result.minimum_reception = result.minimumReceived.toString();
        result.price_impact = data.estimatedPriceImpact;
        result.tx_data = data.data;
        res.send(result);
        quoteCache.set(
            `quote_0x:${srcToken}:${destToken}:${inputAmounts}:${side}:${slippage}:${senderAddress}:${protocols}:${chainId}`,
            result
        );
    } catch (err) {
        console.log(err);
        res.send(nullResult());
    }
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
