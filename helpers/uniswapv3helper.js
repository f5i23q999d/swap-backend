const V3QUOTEABI2 = require("./abi/v3quote2.json");
const { ethers } = require("ethers");
const ADDRESS = require("./constant/addresses.js");
const BigNumber = require("bignumber.js");

class Uniswapv3helper {
    // 每个helper处理一种swap， token1是输入token，token2是输出token,amountIn是输入数量，part是分成多少份, 根据输入数量和分成份数，计算输出数量
    async getOutputByExactInput(
        token1,
        token2,
        amountIn,
        fee,
        router,
        part,
        signer
    ) {
        if (token1 === ADDRESS.ETH) {
            token1 = ADDRESS.WETH;
        }
        const contract = new ethers.Contract(router, V3QUOTEABI2, signer);
        amountIn = new BigNumber(amountIn);
        const queries = [];
        for (let i = 1; i <= part; i++) {
            queries.push(
                contract.callStatic.quoteExactInputSingle({
                    tokenIn: token1,
                    tokenOut: token2,
                    fee,
                    amountIn: amountIn
                        .multipliedBy(i)
                        .dividedToIntegerBy(part)
                        .toString(),
                    sqrtPriceLimitX96: 0,
                })
            );
        }
        let res = [];
        try {
            const ans = await Promise.all(queries);
            res.push(new BigNumber(0));
            for (let i = 0; i < part; i++) {
                res.push(new BigNumber(ans[i].amountOut.toString()));
            }
        } catch (err) {
            res = new Array(Number(part) + 1).fill(new BigNumber(0)); //没有交易池，返回0
        }

        return res;
    }
}

module.exports = Uniswapv3helper;
