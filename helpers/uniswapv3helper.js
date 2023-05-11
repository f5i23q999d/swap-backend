const V3QUOTEABI2 = require("./abi/v3quote2.json");
const { ethers } = require("ethers");
const ADDRESS = require("./constant/addresses.js");
const BigNumber = require("bignumber.js");
const IERC20 = require("./abi/IERC20.json");
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

        


        try {
            if (token1 === ADDRESS.ETH) {
                token1 = ADDRESS.WETH;
            }
            const contract = new ethers.Contract(router, V3QUOTEABI2, signer);
            amountIn = new BigNumber(amountIn);
            // const queries = [];
            // for (let i = 1; i <= part; i++) {                
            //     queries.push(
            //         contract.callStatic.quoteExactInputSingle({
            //             tokenIn: token1,
            //             tokenOut: token2,
            //             fee,
            //             amountIn: amountIn
            //                 .multipliedBy(i)
            //                 .dividedToIntegerBy(part)
            //                 .toString(),
            //             sqrtPriceLimitX96: 0,
            //         })
            //     );
            // }
            // let res = [];
            // try {
            //     const ans = await Promise.all(queries);
            //     res.push(new BigNumber(0));
            //     for (let i = 0; i < part; i++) {                  
            //         res.push(new BigNumber(ans[i].amountOut.toString()));
            //     }
            // } catch (err) {
            //     res = new Array(Number(part) + 1).fill(new BigNumber(0)); //没有交易池，返回0
            // }
            // return res;

            const queries = [];
            const query =  contract.callStatic.quoteExactInputSingle({
                    tokenIn: token1,
                    tokenOut: token2,
                    fee,
                    amountIn: amountIn.toString(),
                    sqrtPriceLimitX96: 0,
                });
                const floor_part = Math.floor(Number(part)*0.75)

                const query2 =  floor_part == 0 ?new BigNumber(0):contract.callStatic.quoteExactInputSingle({
                    tokenIn: token1,
                    tokenOut: token2,
                    fee,
                    amountIn: amountIn.multipliedBy(floor_part).dividedToIntegerBy(part).toString(),
                    sqrtPriceLimitX96: 0,
                });
                queries.push(query);
                queries.push(query2);
                const ans = await Promise.all(queries);

                let res = [];
                res.push(new BigNumber(0));
                for (let i = 1; i <= part; i++) {       
                    if (i == part ){           
                        res.push(new BigNumber(ans[0].amountOut.toString()));
                    }else if (i >=floor_part && (floor_part!==part || floor_part!==0)){
                        res.push(new BigNumber(ans[1].amountOut.toString()));
                    }else{
                        res.push(new BigNumber(0));
                    }
                }

            return res;
        } 
        
        
        
        
        
        catch (err) {
            return new Array(Number(part) + 1).fill(new BigNumber(0));
        }
    }
}

module.exports = Uniswapv3helper;
