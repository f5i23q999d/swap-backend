const V3QUOTEABI2 = require('./abi/v3quote2.json');
const { ethers } = require('ethers');
const ADDRESS = require('./constant/addresses');
const BigNumber = require('bignumber.js');
const IERC20 = require('./abi/IERC20.json');
const Util = require('./utils/util.js');
const BN = Util.BN;
class UniswapV3Helper {
  /**
   * @description  Each helper processes a swap. The output quantity is calculated based on the input quantity and the number of parts divided.
   * @param {string} tokenIn input token
   * @param {string} tokenOut output token
   * @param {string} amountIn input quantity
   * @param {Number} fee UniswapV3 pool fee
   * @param {string} router UniswapV3 router address
   * @param {Number} part the number of parts divided
   * @param {any} signer
   * @returns {Array}
   */
  async getOutputByExactInput(tokenIn, tokenOut, amountIn, fee, router, part, signer) {
    try {
      if (tokenIn === ADDRESS.ETH) {
        tokenIn = ADDRESS.WETH;
      }
      const contract = new ethers.Contract(router, V3QUOTEABI2, signer);
      amountIn = BN(amountIn);
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
          ? BN(0)
          : contract.callStatic.quoteExactInputSingle({
              tokenIn: tokenIn,
              tokenOut: tokenOut,
              fee,
              amountIn: amountIn.multipliedBy(floor_part).dividedToIntegerBy(part).toString(),
              sqrtPriceLimitX96: 0
            });
      queries = [query, query75];
      const ans = await Promise.all(queries);
      let res = [];
      res.push(BN(0));
      for (let i = 1; i <= part; i++) {
        if (i == part) {
          res.push(BN(ans[0].amountOut.toString()));
        } else if (i >= floor_part && (floor_part !== part || floor_part !== 0)) {
          res.push(BN(ans[1].amountOut.toString()));
        } else {
          res.push(BN(0));
        }
      }
      return res;
    } catch (err) {
      return new Array(Number(part) + 1).fill(BN(0));
    }
  }
}

module.exports = UniswapV3Helper;
