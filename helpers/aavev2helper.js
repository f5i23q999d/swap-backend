const aaveTokenList = require('./constant/aavev2list.json');
const AAVEPOOLV2ABI = require('./abi/aavev2.json');
const Util = require('./utils/util.js');
const BN = Util.BN;
class AaveV2Helper {
    constructor() {
        this.list = aaveTokenList.proto;
    }

    async getOutputByExactInput(tokenIn, tokenOut, amountIn, router, part, sign) {
        // aave 1：1 兑换比例
        part = Number(part);
        if (
            (this.isAToken(tokenIn) && this.getAToken(tokenOut) === tokenIn) ^
            (this.isAToken(tokenOut) && this.getAToken(tokenIn) === tokenOut)
        ) {
            const res = new Array(part + 1).fill(0);
            for (let i = 0; i <= part; i++) {
                res[i] = BN((amountIn * i) / part);
            }
            return res;
        }
        return new Array(part + 1).fill(BN(0));
    }

    isAToken(token) {
        for (let i of this.list) {
            if (i.aTokenAddress === token) {
                return true;
            }
        }
        return false;
    }

    getUnderlyingToken(token) {
        for (let i of this.list) {
            if (i.aTokenAddress === token) {
                return i.address;
            }
        }
        return '';
    }

    getAToken(token) {
        for (let i of this.list) {
            if (i.address === token) {
                return i.aTokenAddress;
            }
        }
        return '';
    }
}

module.exports = AaveV2Helper;
