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

class zeroEx {
  constructor() {
    this.cache = new Cache(5);
    this.zeroExSourcesCache = new Cache(60 * 60 * 24);
    this.zeroExKeyIndex = 0;
    this.aggregatorCommon = new AggregatorCommon();
  }

  async getQuote(req) {
    try {
      const srcToken = req.query.source_token; // 源token
      const destToken = req.query.target_token; // 目标token
      const amount = req.query.amount; // 源token数量
      const side = req.query.side ? String(req.query.side) : 'SELL';
      const slippage = isNaN(Number(req.query.slippage)) ? 0.03 : Number(req.query.slippage) / 100; // 滑点
      const senderAddress = req.query.sender_address; // 用户地址
      const protocols = req.query.protocols;
      const chainId = isNaN(Number(req.query.chainId)) ? 1 : Number(req.query.chainId);
      const showComparison = req.query.showComparison || false;
      let paraProtocols = null; // for paraswap api query
      const swapAPIEndpoints_prefix = this.swapAPIEndpoints_0x(chainId);
      if (swapAPIEndpoints_prefix === '') {
        throw 40003;
      }
      if (Number(amount) <= 0) {
        throw 40000;
      }
      if (srcToken === destToken) {
        throw 40001;
      }
      const quoteCache = this.cache.get(
        `quote_0x:${srcToken}:${destToken}:${amount}:${side}:${slippage}:${senderAddress}:${protocols}:${chainId}`
      );
      if (quoteCache) {
        return quoteCache;
      }
      let srcTokenQuery = null;
      let destTokenQuery = null;
      const signer = this.getSignerByChainId(chainId); // Obtain signer according to different chains
      const allTokens = await this.aggregatorCommon.getTokenList(chainId, config.allTokens, 'allTokens');

      if (allTokens) {
        const _srcToken = allTokens.tokenList.find(
          (item) => item.address.toLocaleLowerCase() === srcToken.toLocaleLowerCase()
        );
        const _destToken = allTokens.tokenList.find(
          (item) => item.address.toLocaleLowerCase() === destToken.toLocaleLowerCase()
        );
        if (_srcToken) {
          srcTokenQuery = _srcToken.decimals;
        }
        if (_destToken) {
          destTokenQuery = _destToken.decimals;
        }
      }
      if (!srcTokenQuery) {
        srcTokenQuery = srcToken === ADDRESS.ETH ? 18 : Util.getDecimals(srcToken, signer);
      }
      if (!destTokenQuery) {
        destTokenQuery = destToken === ADDRESS.ETH ? 18 : Util.getDecimals(destToken, signer);
      }

      let base_queries = [srcTokenQuery, destTokenQuery, this.getZeroExSources(chainId)];
      const base_queries_result = await Promise.all(base_queries);
      const srcDecimals = base_queries_result[0]; // 跟srcToken对应
      const destDecimals = base_queries_result[1]; // 跟destToken对应
      let params = {}; // for 0x api query
      params.sellToken = srcToken;
      params.buyToken = destToken;
      side === 'SELL' ? (params.sellAmount = amount) : (params.buyAmount = amount);
      // params.takerAddress = senderAddress; // 省略takerAddress否则不能兑换时无报价结果返回
      params.slippagePercentage = slippage;
      params.affiliateAddress = wallet.address;
      if (String(protocols) === '-1') {
        //没有选择协议的时候返回流动性不足
        return this.aggregatorCommon.nullResult();
      }
      if (protocols) {
        const result = [];
        paraProtocols = [];
        const list = base_queries_result[2].data.records;
        const words = protocols.split(',');
        list.forEach((item) => {
          if (!words.includes(item)) {
            result.push(item);
          }
        });
        words.forEach((item) => {
          paraProtocols.push(item.replace('_', ''));
        });

        params.excludedSources = result.join(',');
      }
      let paraParams = {}; // for paraSwap api query
      paraParams.srcToken = srcToken;
      paraParams.destToken = destToken;
      paraParams.amount = amount;
      paraParams.srcDecimals = srcDecimals;
      paraParams.destDecimals = destDecimals;
      paraParams.side = side;
      paraParams.otherExchangePrices = true;
      paraParams.userAddress = '0x0000000000000000000000000000000000000000';
      paraParams.network = chainId;
      paraParams.maxImpact = 100;
      if (paraProtocols) {
        paraParams.excludeDEXS = false;
        paraParams.includeDEXS = paraProtocols.join(',');
      }
      const paraSwapInfoQuery = showComparison
        ? axios.get(`https://api.paraswap.io/prices/`, {
            params: paraParams
          })
        : {};
      const core_queries = [
        axios.get(`${swapAPIEndpoints_prefix}/swap/v1/quote`, {
          params,
          headers: {
            '0x-api-key': this.get0xAPIkey()
          }
        }),
        paraSwapInfoQuery,
        this.aggregatorCommon.getETHPriceByDxPoolService(1, chainId)
      ];
      const core_queries_result = await Promise.all(core_queries);
      const data = core_queries_result[0].data;
      const paraData = core_queries_result[1].data;
      let result = {};
      result.source_token = srcToken;
      result.target_token = destToken;
      result.source_token_amount = data.sellAmount;
      result.target_token_amount = data.buyAmount;
      result.maximumPaid = BN(data.sellAmount)
        .multipliedBy(1 + 0.0016)
        .multipliedBy(1 + slippage)
        .dividedBy(10 ** srcDecimals)
        .toFixed(srcDecimals)
        .toString(); // 除了滑点，需要再算上0x协议的手续费
      result.minimumReceived = BN(data.buyAmount)
        .multipliedBy(1 - slippage)
        .dividedBy(10 ** destDecimals)
        .toFixed(destDecimals)
        .toString();
      result.estimate_gas = data.estimatedGas;
      const ethPrice = core_queries_result[2];
      result.estimate_cost = BN(data.estimatedGas)
        .multipliedBy(data.gasPrice)
        .multipliedBy(ethPrice)
        .dividedBy(10 ** 18)
        .toFixed(18)
        .toString();
      // 返回给前端显示的金额, SELL时，是buyAmount, BUY时， 是sellAmount
      result.amount =
        side === 'SELL'
          ? BN(result.target_token_amount).dividedBy(10 ** destDecimals)
          : BN(result.source_token_amount).dividedBy(10 ** srcDecimals);
      result.amount_with_slippage = side === 'SELL' ? result.minimumReceived : result.maximumPaid;
      result.price_impact = data.estimatedPriceImpact;
      if (!result.price_impact) {
        // 0xAPI没有price impact数据，使用paraSwap数据
        if (showComparison) {
          result.price_impact =
            ((Number(paraData.priceRoute.destUSD) - Number(paraData.priceRoute.srcUSD)) /
              Number(paraData.priceRoute.srcUSD)) *
            100;
        } else {
          result.price_impact = 0;
        }
      }
      result.tx_data = data.data;
      const swaps = [];
      swaps.push({
        name: 'FxSwap',
        price: BN(result.target_token_amount)
          .dividedBy(10 ** destDecimals)
          .dividedBy(BN(result.source_token_amount).dividedBy(10 ** srcDecimals))
          .toFixed(18)
          .toString(), // price无论SELL还是BUY，都是destToken / srcToken
        user_amount: result.amount, // sell的时候是youGet, buy的时候是youPaid
        fees: result.estimate_cost
      });
      if (showComparison) {
        for (const other of paraData.priceRoute.others) {
          swaps.push({
            name: other.exchange,
            price: BN(other.destAmount)
              .dividedBy(10 ** destDecimals)
              .dividedBy(BN(other.srcAmount).dividedBy(10 ** srcDecimals))
              .toString(),
            user_amount:
              side === 'SELL'
                ? BN(other.destAmount)
                    .dividedBy(10 ** destDecimals)
                    .toString()
                : BN(other.srcAmount)
                    .dividedBy(10 ** srcDecimals)
                    .toString(),
            fees: other.data.gasUSD
          });
        }
      }
      const paths = [{ part: 100, path: [[]] }];
      for (let i = 0; i < data.sources.length; i++) {
        if (Number(data.sources[i].proportion) > 0) {
          paths[0].path[0].push({
            name: data.sources[i].name,
            part: Number(data.sources[i].proportion),
            source_token: side === 'SELL' ? srcToken : destToken,
            target_token: side === 'SELL' ? destToken : srcToken
          });
        }
      }
      let distribution_count = 0;
      for (let i = 0; i < paths[0].path[0].length; i++) {
        distribution_count += Number(paths[0].path[0][i].part);
      }
      for (let i = 0; i < paths[0].path[0].length; i++) {
        paths[0].path[0][i].part = (Number(paths[0].path[0][i].part) / distribution_count) * 100;
      }
      for (let i = 1; i < swaps.length; i++) {
        if (swaps[i].name === paths[0].path[0][0].name.replace('_', '')) {
          // data align
          swaps[i].price = swaps[0].price;
          swaps[i].user_amount = swaps[0].user_amount;
        }
      }
      result.swaps = swaps;
      result.paths = paths;
      result.to = this.aggregatorCommon.getProxyAddressByChainId(chainId);

      this.cache.set(
        `quote_0x:${srcToken}:${destToken}:${amount}:${side}:${slippage}:${senderAddress}:${protocols}:${chainId}`,
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
        if (err.response.data.message && err.response.data.message.indexOf('Rate limit exceeded') !== -1) {
          return {
            code: 40047,
            message: errCode['40047'].msg
          };
        }
        if (err.response.data.error && err.response.data.error.indexOf('too small') !== -1) {
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

  get0xAPIkey() {
    return config['0x_apikeys'][++this.zeroExKeyIndex % config['0x_apikeys'].length];
  }

  swapAPIEndpoints_0x(chainId) {
    switch (chainId) {
      case 1:
        return 'https://api.0x.org';
      case 5:
        return 'https://goerli.api.0x.org';
      case 56:
        return 'https://bsc.api.0x.org';
      case 137:
        return 'https://polygon.api.0x.org';
      case 43114:
        return 'https://avalanche.api.0x.org';
      case 250:
        return 'https://fantom.api.0x.org';
      case 10:
        return 'https://optimism.api.0x.org';
      case 42161:
        return 'https://arbitrum.api.0x.org';
      default:
        return '';
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

  async getZeroExSources(chainId) {
    const cache = this.zeroExSourcesCache.get(`zeroExSourcesCache:${chainId}`);
    if (cache) {
      return cache;
    }
    try {
      const swapAPIEndpoints_prefix = this.swapAPIEndpoints_0x(chainId);
      const list = await axios.get(`${swapAPIEndpoints_prefix}/swap/v1/sources`, {
        headers: {
          '0x-api-key': this.get0xAPIkey()
        }
      });
      this.zeroExSourcesCache.set(`zeroExSourcesCache:${chainId}`, list);
      return list;
    } catch (err) {
      console.log(err);
      return null;
    }
  }
}

module.exports = zeroEx;
