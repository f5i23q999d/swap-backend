const aaveTokenList = require("./constant/aavev2list.json");
const AAVEPOOLV2ABI = require("./abi/aavev2.json");
const BigNumber = require("bignumber.js");

class Aavehelper {

    constructor() {
        this.list = aaveTokenList.proto;
    }

    async getOutputByExactInput(
        token1,
        token2,
        amountIn,
        router,
        part,
        sign
    ) {
        // aave 1：1 兑换比例
        part = Number(part);
        if (this.isAToken(token1) ^ this.isAToken(token2)) {
            const res = new Array(part + 1).fill(0);
            for (let i = 0; i <= part; i++) {
                res[i] = new BigNumber((amountIn * i) / part);
            }
            return res;
        }
        return new Array(part + 1).fill(new BigNumber(0));
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
        return "";
    }

    getAToken(token) {
        for (let i of this.list) {
            if (i.address === token) {
                return i.aTokenAddress;
            }
        }
        return "";
    }
}

module.exports = Aavehelper;    