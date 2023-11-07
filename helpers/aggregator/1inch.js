const AggregatorCommon = require('./aggregatorCommon');
const Cache = require('../utils/cache');
const config = require('../../config');
const Util = require('../utils/util');
const errCode = require('../utils/errorCode');
const { ethers } = require('ethers');
const axios = require('axios');
const ADDRESS = require('../constant/addresses');
const provider = new ethers.providers.JsonRpcProvider(config.rpcs.eth);
const wallet = new ethers.Wallet(config.privateKey, provider);
const BN = Util.BN; // 大整数转换

class OneInch {
  constructor() {
    this.cache = new Cache(5);
    this.KeyIndex = 0;
    this.aggregatorCommon = new AggregatorCommon();
  }

  async getQuote(req) {
    try {
      const srcToken = req.query.source_token; // 源token
      const destToken = req.query.target_token; // 目标token
      const amount = req.query.amount; // 源token数量
      const side = 'SELL'; // 1inch 只支持sell
      const slippage = isNaN(Number(req.query.slippage)) ? 0.5 : Number(req.query.slippage); // 滑点, 1inch的1代表1%
      const senderAddress = req.query.sender_address; // 用户地址
      const chainId = isNaN(Number(req.query.chainId)) ? 1 : Number(req.query.chainId);

      const swapAPIEndpoints_prefix = `https://api.1inch.dev`;
      if (Number(amount) <= 0) {
        throw 40000;
      }
      if (srcToken === destToken) {
        throw 40001;
      }
      const quoteCache = this.cache.get(
        `quote_0x:${srcToken}:${destToken}:${amount}:${side}:${slippage}:${senderAddress}:${chainId}`
      );
      if (quoteCache) {
        return quoteCache;
      }
      const signer = this.getSignerByChainId(chainId); // Obtain signer according to different chains
      const allTokens = await this.aggregatorCommon.getTokenList(chainId, config.allTokens, 'allTokens');
      let srcTokenInfo = null;
      let destTokenInfo = null;
      let srcTokenNameQuery = null;
      let destTokenNameQuery = null;
      if (allTokens) {
        srcTokenInfo = allTokens.tokenList.find(
          (item) => item.address.toLocaleLowerCase() === srcToken.toLocaleLowerCase()
        );
        destTokenInfo = allTokens.tokenList.find(
          (item) => item.address.toLocaleLowerCase() === destToken.toLocaleLowerCase()
        );
      }
      if (srcTokenInfo) {
        srcTokenNameQuery = srcTokenInfo.symbol;
      }
      if (destTokenInfo) {
        destTokenNameQuery = destTokenInfo.symbol;
      }

      if (srcToken === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
        srcTokenNameQuery = this.getChainSymbol(chainId);
      }
      if (destToken === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
        destTokenNameQuery = this.getChainSymbol(chainId);
      }

      let params = {}; // for 0x api query
      params.src = srcToken;
      params.dst = destToken;
      params.amount = amount;
      params.from = senderAddress; // 省略takerAddress否则不能兑换时无报价结果返回
      params.slippage = slippage;
      params.disableEstimate = true;
      params.includeGas = true;
      params.includeTokensInfo = true;
      const core_queries = [
        axios.get(`${swapAPIEndpoints_prefix}/swap/v5.2/${chainId}/swap`, {
          params,
          headers: {
            Authorization: `Bearer ${this.get1inchAPIkey()}`
          }
        }),
        this.aggregatorCommon.getPriceByDxPoolService(1, chainId),
        axios.get(`${swapAPIEndpoints_prefix}/swap/v5.2/${chainId}/quote`, {
          params,
          headers: {
            Authorization: `Bearer ${this.get1inchAPIkey()}`
          }
        }),
        this.aggregatorCommon.getPriceByDxPoolService(
          1,
          chainId,
          srcTokenNameQuery || await Util.getSymbol(srcToken, signer)
        ),
        this.aggregatorCommon.getPriceByDxPoolService(
          1,
          chainId,
          destTokenNameQuery || await Util.getSymbol(destToken, signer)
        )
      ];
      const core_queries_result = await Promise.all(core_queries);
      const data = core_queries_result[0].data;
      const srcDecimals = data.fromToken.decimals; // 跟srcToken对应
      const destDecimals = data.toToken.decimals; // 跟destToken对应
      let result = {};
      result.source_token = srcToken;
      result.target_token = destToken;
      result.source_token_amount = amount;
      result.target_token_amount = data.toAmount;
      result.minimumReceived = BN(data.toAmount)
        .multipliedBy(1 - slippage / 100)
        .dividedBy(10 ** destDecimals)
        .toFixed(destDecimals)
        .toString();
      result.estimate_gas = core_queries_result[2].data.gas;
      const ethPrice = core_queries_result[1];
      result.estimate_cost = BN(result.estimate_gas)
        .multipliedBy(data.tx.gasPrice)
        .multipliedBy(ethPrice)
        .dividedBy(10 ** 18)
        .toString();

      result.amount = BN(result.target_token_amount).dividedBy(10 ** destDecimals);
      result.amount_with_slippage = result.minimumReceived;
      const srcTokenPrice = BN(core_queries_result[3]);
      const destTokenPrice = BN(core_queries_result[4]);
      const srcTokenPriceWithDecimals = BN(amount).dividedBy(10 ** srcDecimals);
      const destTokenPriceWithDecimals = BN(data.toAmount).dividedBy(10 ** destDecimals);
      const srcTokenTotalPrice = srcTokenPrice.multipliedBy(srcTokenPriceWithDecimals);
      const destTokenTotalPrice = destTokenPrice.multipliedBy(destTokenPriceWithDecimals);
      let price_impact = srcTokenTotalPrice
        .minus(destTokenTotalPrice)
        .dividedBy(srcTokenTotalPrice)
        .multipliedBy(100)
        .toFixed(2);
      if (isNaN(price_impact)) {
        price_impact = 0;
      }
      result.price_impact = price_impact;

      result.tx_data = data.tx.data;
      const swaps = [];
      const paths = [{ part: 100, path: [[]] }];
      let distribution_count = 0;
      for (let i = 0; i < paths[0].path[0].length; i++) {
        distribution_count += Number(paths[0].path[0][i].part);
      }
      for (let i = 0; i < paths[0].path[0].length; i++) {
        paths[0].path[0][i].part = (Number(paths[0].path[0][i].part) / distribution_count) * 100;
      }

      result.swaps = swaps;
      result.paths = paths;
      result.to = data.tx.to;

      this.cache.set(
        `quote_0x:${srcToken}:${destToken}:${amount}:${side}:${slippage}:${senderAddress}:${chainId}`,
        result
      );
      return result;
    } catch (err) {
      for (const key in errCode) {
        if (Number(key) === err) {
          return {
            code: key,
            message: errCode[key].msg
          };
        }
      }
      console.log(err);
      try {
        if (err.response.statusText === 'Too Many Requests') {
          return {
            code: 40047,
            message: errCode['40047'].msg
          };
        }
        if (err.response.data.description === 'insufficient liquidity') {
          return {
            code: 40048,
            message: errCode['40048'].msg
          };
        }
      } catch {
        return this.aggregatorCommon.nullResult();
      }
      return this.aggregatorCommon.nullResult();
    }
  }

  get1inchAPIkey() {
    return config['1inch_apikeys'][++this.KeyIndex % config['1inch_apikeys'].length];
  }

  getChainSymbol(chainId) {
    switch (chainId) {
      case 1:
        return 'ETH';
      case 56:
        return 'BNB';
      case 137:
        return 'matic';
      case 43114:
        return 'AVAX';
      case 250:
        return 'FTM';
      case 10:
        return 'ETH';
      case 42161:
        return 'ETH';
      default:
        return 'ETH';
    }
  }

  getSignerByChainId(chainId) {
    let rpc_url = '';
    switch (chainId) {
      case 1:
        rpc_url = config.rpcs.eth;
        break;
      case 56:
        rpc_url = config.rpcs.bsc;
        break;
      case 137:
        rpc_url = config.rpcs.polygon;
        break;
      case 43114:
        rpc_url = config.rpcs.avalanche;
        break;
      case 250:
        rpc_url = config.rpcs.fantom;
        break;
      case 10:
        rpc_url = config.rpcs.optimism;
        break;
      case 42161:
        rpc_url = config.rpcs.arbitrum;
        break;
    }
    const provider = new ethers.providers.JsonRpcProvider(rpc_url);
    const wallet = new ethers.Wallet(config.privateKey, provider);
    const signer = provider.getSigner(wallet.address);
    return signer;
  }
}

module.exports = OneInch;
