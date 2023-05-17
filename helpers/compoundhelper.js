const compoundTokenList = require('./constant/compoundlist.json');
const BigNumber = require('bignumber.js');

class Compoundhelper {
  constructor() {
    this.list = compoundTokenList.tokens.filter(item => item.chainId === 1);;
    this.addressSet = new Set(list.map(item => item.address.toLowerCase()));
  }

  async getOutputByExactInput(
    token1,
    token2,
    amountIn,
    router,
    part,
    sign
  ) {
    part = Number(part);
    if (
      (this.isAToken(token1) && this.getCToken(token2) === token1) ^
      (this.isAToken(token2) && this.getCToken(token1) === token2)
    ) {
      const res = new Array(part + 1).fill(0);
      for (let i = 0; i <= part; i++) {
        res[i] = new BigNumber((amountIn * i) / part);
      }
      return res;
    }
    return new Array(part + 1).fill(new BigNumber(0));
  }

  isCToken(token) {
    return this.addressSet.has(token.toLowerCase());
  }

  getUnderlyingToken(token) {
    const tokenItem = this.list.find(item => item.address.toLowerCase() === token.toLowerCase());
    const symbol = tokenItem?.symbol.toLowerCase().split('c')[1] || '';
    const symbolItem = this.list.find(item => item.symbol.toLowerCase() === symbol);
    return symbolItem?.address || '';
  }

  getCToken(token) {
    const tokenItem = this.list.find(item => item.address.toLowerCase() === token.toLowerCase());
    const symbol = `c${tokenItem.symbol.toLowerCase()}`;
    const symbolItem = this.list.find(item => item.symbol.toLowerCase() === symbol);
    return symbolItem?.address || '';
  }
}

module.exports = Compoundhelper;