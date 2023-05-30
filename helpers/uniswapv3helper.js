const V3QUOTEABI2 = require('./abi/v3quote2.json');
const { ethers } = require('ethers');
const ADDRESS = require('./constant/addresses');
const BigNumber = require('bignumber.js');
const IERC20 = require('./abi/IERC20.json');
class UniswapV3Helper {
    // Each helper processes a swap, where tokenIn is the input token, tokenOut is the output token, amountIn is the input quantity, and part is the number of parts divided. The output quantity is calculated based on the input quantity and the number of parts divided
    async getOutputByExactInput(tokenIn, tokenOut, amountIn, fee, router, part, signer) {
        try {
            if (tokenIn === ADDRESS.ETH) {
                tokenIn = ADDRESS.WETH;
            }
            const contract = new ethers.Contract(router, V3QUOTEABI2, signer);
            amountIn = new BigNumber(amountIn);
            let queries = [];
            const query = contract.callStatic.quoteExactInputSingle({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee,
                amountIn: amountIn.toString(),
                sqrtPriceLimitX96: 0
            });
            const floor_part = Math.floor(Number(part) * 0.75);
            const query75 =
                floor_part == 0
                    ? new BigNumber(0)
                    : contract.callStatic.quoteExactInputSingle({
                          tokenIn: tokenIn,
                          tokenOut: tokenOut,
                          fee,
                          amountIn: amountIn.multipliedBy(floor_part).dividedToIntegerBy(part).toString(),
                          sqrtPriceLimitX96: 0
                      });
            queries = [query,query75];
            const ans = await Promise.all(queries);
            let res = [];
            res.push(new BigNumber(0));
            for (let i = 1; i <= part; i++) {
                if (i == part) {
                    res.push(new BigNumber(ans[0].amountOut.toString()));
                } else if (i >= floor_part && (floor_part !== part || floor_part !== 0)) {
                    res.push(new BigNumber(ans[1].amountOut.toString()));
                } else {
                    res.push(new BigNumber(0));
                }
            }
            return res;
        } catch (err) {
            return new Array(Number(part) + 1).fill(new BigNumber(0));
        }
    }
}

module.exports = UniswapV3Helper;
