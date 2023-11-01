const { ethers } = require('ethers');
const IERC20 = require('../abi/IERC20.json');
const BigNumber = require('bignumber.js');

class Util {
  // 获取token的decimals
  static async getDecimals(token, signer) {
    const erc20 = new ethers.Contract(token, IERC20, signer);
    const decimal = await erc20.decimals();
    return decimal;
  }

  static async getSymbol(token, signer) {
    const erc20 = new ethers.Contract(token, IERC20, signer);
    const symbol = await erc20.symbol();
    return symbol;
  }

  static BN(value) {
    return new BigNumber(value);
  }

  static getIpfsPath(originLink) {
    const cleanUrl = originLink.replace('ipfs://', '');
    const result = 'https://cloudflare-ipfs.com/ipfs/' + cleanUrl;
    return result;
  }
}

module.exports = Util;
