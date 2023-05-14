
const { ethers } = require("ethers");
const IERC20 = require("../abi/IERC20.json");


class Util {

    // 获取token的decimals
    static async getDecimals(token,signer) {
        const erc20 = new ethers.Contract(token, IERC20, signer);
        const decimal = await erc20.decimals();
        return decimal;
    }

    static async getSymbol(token,signer) {
        const erc20 = new ethers.Contract(token, IERC20, signer);
        const symbol = await erc20.symbol();
        return symbol;
    }

}

module.exports = Util;