const IUniswapV2Factory = require('./abi/IUniswapV2Factory.json');
const IERC20 = require('./abi/IERC20.json');
const { ethers } = require('ethers');
const ADDRESS = require('./constant/addresses.js');
const Util = require('./utils/util.js');
const BN = Util.BN;

class UniswapV2Helper {
  async getOutputByExactInput(tokenIn, tokenOut, amountIn, router, part, signer) {
    try {
      const contract = new ethers.Contract(router, IUniswapV2Factory, signer);

      if (tokenIn === ADDRESS.ETH) {
        tokenIn = ADDRESS.WETH;
      }
      if (tokenOut === ADDRESS.ETH) {
        tokenOut = ADDRESS.WETH;
      }

      const pool = await contract.getPair(tokenIn, tokenOut);
      if (pool === '0x0000000000000000000000000000000000000000') {
        return new Array(Number(part) + 1).fill(BN(0));
      }

      const tokenInContract = new ethers.Contract(tokenIn, IERC20, signer);
      const tokenOutContract = new ethers.Contract(tokenOut, IERC20, signer);
      const balance_queries = await Promise.all([tokenInContract.balanceOf(pool), tokenOutContract.balanceOf(pool)]);
      const tokenInBalance = balance_queries[0];
      const tokenOutBalance = balance_queries[1];
      const res = [];
      for (let i = 0; i <= part; i++) {
        const amountIn_part = (amountIn * i) / part;
        res.push(
          BN(((amountIn_part * tokenOutBalance * 997) / (tokenInBalance * 1000 + amountIn_part * 997)).toFixed(0))
        );
      }

      return res;
    } catch (err) {
      return new Array(Number(part) + 1).fill(BN(0));
    }
  }
}

module.exports = UniswapV2Helper;
