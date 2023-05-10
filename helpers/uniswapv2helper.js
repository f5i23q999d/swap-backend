const IUniswapV2Factory = require("./abi/IUniswapV2Factory.json");
const IERC20 = require("./abi/IERC20.json");
const { ethers } = require("ethers");
const ADDRESS = require("./constant/addresses.js");
const BigNumber = require("bignumber.js");

class Uniswapv2helper {
    async getOutputByExactInput(
        token1,
        token2,
        amountIn,
        router,
        part,
        signer
    ) {
        try {
            const contract = new ethers.Contract(router, IUniswapV2Factory, signer);

            if (token1 === ADDRESS.ETH) {
                token1 = ADDRESS.WETH;
            }
            if (token2 === ADDRESS.ETH) {
                token2 = ADDRESS.WETH;
            }

            const pool = await contract.getPair(token1, token2);
            if (pool === "0x0000000000000000000000000000000000000000") {
                return new Array(Number(part) + 1).fill(new BigNumber(0))
            }

            const token1Contract = new ethers.Contract(token1, IERC20, signer);
            const token2Contract = new ethers.Contract(token2, IERC20, signer);
            const token1Balance = await token1Contract.balanceOf(pool);
            const token2Balance = await token2Contract.balanceOf(pool);

            const res = [];
            for (let i = 0; i <= part; i++) {
                const amountIn_part = (amountIn * i) / part;
                res.push(
                    new BigNumber(
                        ((amountIn_part * token2Balance * 997) / (token1Balance * 1000 + amountIn_part * 997)).toFixed(0))
                );
            }

            return res;
        }
        catch (err) {
            return new Array(Number(part) + 1).fill(new BigNumber(0));
        }
    }
}


module.exports = Uniswapv2helper;