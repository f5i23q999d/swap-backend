const BigNumber = require("bignumber.js");
const { PMMState } = require("./utils/PMM/PMMState.js");
const { PMMHelper } = require("./utils/PMM/PMMHelper.js");
const IERC20 = require("./abi/IERC20.json");
const { ethers } = require("ethers");
const ADDRESS = require("./constant/addresses.js");
const dodoZooABI = require("./abi/dodozoo.json");
const iDODOStableABI = require("./abi/IDODOStable.json");

function fromWei(numStr, decimals) {
  return new BigNumber(String(numStr)).div(new BigNumber(10 ** decimals));
}

class Dodohelper {
  async getOutputByExactInput(token1, token2, amountIn, router, part, signer) {
    try {
      const res = [];
      amountIn = new BigNumber(amountIn);
      // 先查询是否为v1池子
      let version = 1;
      const dodoZoo = new ethers.Contract(ADDRESS.DODOZOO, dodoZooABI, signer);
      let POOL_ADDRESS = "";
      let baseToken = "";
      let quoteToken = "";
      const address1 = await dodoZoo.getDODO(token1, token2);
      const address2 = await dodoZoo.getDODO(token2, token1);
      let token1IsBase = true;
      POOL_ADDRESS = address1;
      baseToken = token1;
      quoteToken = token2;
      if (address1 === "0x0000000000000000000000000000000000000000") {
        token1IsBase = false;
        POOL_ADDRESS = address2;
        baseToken = token2;
        quoteToken = token1;
      }
      if (
        address1 === "0x0000000000000000000000000000000000000000" &&
        address2 === "0x0000000000000000000000000000000000000000"
      ) {
        version = 2; // 不是v1池子
      }

      if (version === 1) {
        const DODOV1_ABI = require("./abi/IDODOV1.json");
        const pmmHelper = new PMMHelper();
        /*
                
                        Helper Contract address on multi chain:
                            - ETH: 0x6373ceB657C83C91088d328622573FB766064Ac4
                            - BSC: 0x2BBD66fC4898242BDBD2583BBe1d76E8b8f71445
                            - Polygon: 0x18DFdE99F578A0735410797e949E8D3e2AFCB9D2
                            - HECO: 0xFB973C79C665C0AC69E74C67be90D4C7A6f23c59
                    */
        const POOL_HELPER = "0x6373ceB657C83C91088d328622573FB766064Ac4"; //BSC Helper
        const helperInstance = new ethers.Contract(
          POOL_HELPER,
          DODOV1_ABI,
          signer
        );
        const baseTokenInstance = new ethers.Contract(baseToken, IERC20, signer);
        const baseTokenDecimal = await baseTokenInstance.decimals();
        const quoteTokenInstance = new ethers.Contract(
          quoteToken,
          IERC20,
          signer
        );
        const quoteTokenDecimal = await quoteTokenInstance.decimals();
        const result = await helperInstance.getPairDetail(POOL_ADDRESS);
        const pmmState = new PMMState({
          i: fromWei(result[0].i, 18 - baseTokenDecimal + quoteTokenDecimal),
          K: fromWei(result[0].K, 18),
          B: fromWei(result[0].B, baseTokenDecimal),
          Q: fromWei(result[0].Q, quoteTokenDecimal),
          B0: fromWei(result[0].B0, baseTokenDecimal),
          Q0: fromWei(result[0].Q0, quoteTokenDecimal),
          R: parseInt(result[0].R),
          lpFeeRate: fromWei(result[0].lpFeeRate, 18),
          mtFeeRate: fromWei(result[0].mtFeeRate, 18),
        });

        for (let i = 0; i <= part; i++) {
          let amountIn_part = amountIn.multipliedBy(i).dividedBy(part);
          if (token1IsBase) {
            amountIn_part = amountIn_part.dividedBy(
              new BigNumber(10 ** baseTokenDecimal)
            );
            res.push(
              new BigNumber(
                pmmHelper
                  .QuerySellBase(new BigNumber(amountIn_part), pmmState)
                  .multipliedBy(new BigNumber(10 ** quoteTokenDecimal))
                  .toFixed(0)
              )
            );
          } else {
            amountIn_part = amountIn_part.dividedBy(
              new BigNumber(10 ** quoteTokenDecimal)
            );
            res.push(
              new BigNumber(
                pmmHelper
                  .QuerySellQuote(new BigNumber(amountIn_part), pmmState)
                  .multipliedBy(new BigNumber(10 ** baseTokenDecimal))
                  .toFixed(0)
              )
            );
          }
        }
      } else if (version == 2) {
        var DODOV2_ABI = require("./abi/IDODOV2.json");
        var pmmHelper = new PMMHelper();

        let POOL_ADDRESS = "";
        let baseToken = "";
        let quoteToken = "";
        let token1IsBase = true;
        const dodo_stable = new ethers.Contract(
          ADDRESS.DODO_STABLE_FACTORY,
          iDODOStableABI,
          signer
        );
        const address1 = await dodo_stable.getDODOPool(token1, token2);
        const address2 = await dodo_stable.getDODOPool(token2, token1);
        if (address1.length > 0) {
          POOL_ADDRESS = address1[0];
          baseToken = token1;
          quoteToken = token2;
        } else if (address2.length > 0) {
          POOL_ADDRESS = address2[0];
          baseToken = token2;
          quoteToken = token1;
          token1IsBase = false;
        } else {
          return new Array(Number(part) + 1).fill(new BigNumber(0));
        }

        const baseTokenInstance = new ethers.Contract(baseToken, IERC20, signer);
        const baseTokenDecimal = await baseTokenInstance.decimals();
        const quoteTokenInstance = new ethers.Contract(
          quoteToken,
          IERC20,
          signer
        );
        const quoteTokenDecimal = await quoteTokenInstance.decimals();
        var poolInsntance = new ethers.Contract(POOL_ADDRESS, DODOV2_ABI, signer);

        //Fetch PMMState and FeeRate
        var pmm = await poolInsntance.getPMMStateForCall();
        // Currently feeRate for any address is the same, so you can pass in an zero address as userAccount
        var feeRate = await poolInsntance.getUserFeeRate(
          "0x0000000000000000000000000000000000000000"
        );
        var pmmState = new PMMState({
          i: fromWei(pmm.i, 18 - baseTokenDecimal + quoteTokenDecimal),
          K: fromWei(pmm.K, 18),
          B: fromWei(pmm.B, baseTokenDecimal),
          Q: fromWei(pmm.Q, quoteTokenDecimal),
          B0: fromWei(pmm.B0, baseTokenDecimal),
          Q0: fromWei(pmm.Q0, quoteTokenDecimal),
          R: parseInt(pmm.R),
          lpFeeRate: fromWei(feeRate.lpFeeRate, 18),
          mtFeeRate: fromWei(feeRate.mtFeeRate, 18),
        });

        for (let i = 0; i <= part; i++) {
          let amountIn_part = amountIn.multipliedBy(i).dividedBy(part);
          if (token1IsBase) {
            amountIn_part = amountIn_part.dividedBy(
              new BigNumber(10 ** baseTokenDecimal)
            );
            res.push(
              new BigNumber(
                pmmHelper
                  .QuerySellBase(new BigNumber(amountIn_part), pmmState)
                  .multipliedBy(new BigNumber(10 ** quoteTokenDecimal))
                  .toFixed(0)
              )
            );
          } else {
            amountIn_part = amountIn_part.dividedBy(
              new BigNumber(10 ** quoteTokenDecimal)
            );
            res.push(
              new BigNumber(
                pmmHelper
                  .QuerySellQuote(new BigNumber(amountIn_part), pmmState)
                  .multipliedBy(new BigNumber(10 ** baseTokenDecimal))
                  .toFixed(0)
              )
            );
          }
        }
      } else {
        return new Array(Number(part) + 1).fill(new BigNumber(0));
      }
      return res;
    }
    catch (err) {
      return new Array(Number(part) + 1).fill(new BigNumber(0));
    }
  }

  async tokenInfo(token1, token2, signer) {
    const dodoZoo = new ethers.Contract(ADDRESS.DODOZOO, dodoZooABI, signer);
    let version = 1;
    let POOL_ADDRESS = "";
    let baseToken = "";
    let quoteToken = "";
    const address1 = await dodoZoo.getDODO(token1, token2);
    const address2 = await dodoZoo.getDODO(token2, token1);
    let token1IsBase = true;
    POOL_ADDRESS = address1;
    baseToken = token1;
    quoteToken = token2;
    if (address1 === "0x0000000000000000000000000000000000000000") {
      token1IsBase = false;
      POOL_ADDRESS = address2;
      baseToken = token2;
      quoteToken = token1;
    }
    if (
      address1 === "0x0000000000000000000000000000000000000000" &&
      address2 === "0x0000000000000000000000000000000000000000"
    ) {
      // 查询v2池子
      version = 2;
      const dodo_stable = new ethers.Contract(
        ADDRESS.DODO_STABLE_FACTORY,
        iDODOStableABI,
        signer
      );
      const address1 = await dodo_stable.getDODOPool(token1, token2);
      const address2 = await dodo_stable.getDODOPool(token2, token1);
      if (address1.length > 0) {
        POOL_ADDRESS = address1[0];
      } else if (address2.length > 0) {
        POOL_ADDRESS = address2[0];
        token1IsBase = false;
      }
    }
    return { pool: POOL_ADDRESS, token1IsBase: token1IsBase, version: version };
  }
}
module.exports = Dodohelper;
