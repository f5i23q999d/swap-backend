const Cache = require('../utils/cache');
const ADDRESS = require('../constant/addresses');
const axios = require('axios');
const Util = require('../utils/util');
const BN = Util.BN; // 大整数转换
const config = require('../../config');

class AggregatorCommon {
  constructor() {
    this.tokenListCache = new Cache(60 * 60 * 24);
  }

  nullResult() {
    let result = {};
    result.source_token = ADDRESS.NULL;
    result.target_token = ADDRESS.NULL;
    result.source_token_amount = '0';
    result.target_token_amount = '0';
    result.swaps = [];
    result.paths = [];
    result.minimumReceived = '0';
    result.estimate_gas = '0';
    result.estimate_cost = '0';
    result.reception = '0';
    result.minimum_reception = '0';
    result.price_impact = '0';
    return result;
  }

  getProxyAddressByChainId(chainId) {
    switch (Number(chainId)) {
      case 1:
        return config['0x_Proxy_Addresses'].eth;
      case 56:
        return config['0x_Proxy_Addresses'].bsc;
      case 137:
        return config['0x_Proxy_Addresses'].polygon;
      case 43114:
        return config['0x_Proxy_Addresses'].avalanche;
      case 250:
        return config['0x_Proxy_Addresses'].fantom;
      case 10:
        return config['0x_Proxy_Addresses'].optimism;
      case 42161:
        return config['0x_Proxy_Addresses'].arbitrum;
    }
    return '';
  }

  async getPriceByDxPoolService(amount, chainId = 1, token = 'ETH') {
    try {
      if (token === 'ETH') {
        switch (chainId) {
          case 1:
            token = 'ETH';
            break;
          case 56:
            token = 'BNB';
            break;
          case 137:
            token = 'matic';
            break;
          case 43114:
            token = 'AVAX';
            break;
          case 250:
            token = 'FTM';
            break;
          case 10:
            token = 'ETH';
            break;
          case 42161:
            token = 'ETH';
            break;
        }
      }
      const result = await axios.get(`https://service.price.dxpool.com:3001/price?symbols=${token}`);
      return BN(amount).multipliedBy(Number(result.data.data.price.USD[token] || result.data.data.price.USD[token.toLocaleLowerCase()]));  // 有可能出现小写的情况
    } catch (err) {
      console.log(err);
      return BN(0);
    }
  }

  async getTokenList(chainId, config, cacheName = 'tokens') {
    const cache = this.tokenListCache.get(`${cacheName}:${Number(chainId)}`);
    if (cache) {
      return cache;
    }
    let result = {};
    result.tokenList = [];
    try {
      let fetchList = [];
      let chainName = 'eth';
      switch (chainId) {
        case 1: {
          chainName = 'eth';
          result.tokenList.push({
            chainId: chainId,
            address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            name: 'Ethereum',
            symbol: 'ETH',
            decimals: 18,
            logoURI: config.eth.logo_url
          });
          for (const tokenList_url of config.eth.tokenList_urls) {
            fetchList = fetchList.concat((await axios.get(tokenList_url)).data.tokens);
          }
          break;
        }
        case 5: {
          chainName = 'goerli';
          result.tokenList.push({
            chainId: chainId,
            address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            name: 'Ethereum',
            symbol: 'ETH',
            decimals: 18,
            logoURI: config.eth.logo_url
          });
          for (const tokenList_url of config.goerli.tokenList_urls) {
            fetchList = fetchList.concat((await axios.get(tokenList_url)).data.tokens);
          }
          break;
        }
        case 56: {
          chainName = 'bsc';
          result.tokenList.push({
            chainId: chainId,
            address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            name: 'BNB',
            symbol: 'BNB',
            decimals: 18,
            logoURI: config.bsc.logo_url
          });
          for (const tokenList_url of config.bsc.tokenList_urls) {
            fetchList = fetchList.concat((await axios.get(tokenList_url)).data.tokens);
          }
          break;
        }
        case 137: {
          chainName = 'polygon';
          result.tokenList.push({
            chainId: chainId,
            address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            name: 'Polygon',
            symbol: 'MATIC',
            decimals: 18,
            logoURI: config.polygon.logo_url
          });
          for (const tokenList_url of config.polygon.tokenList_urls) {
            fetchList = fetchList.concat((await axios.get(tokenList_url)).data.tokens);
          }
          break;
        }
        case 43114: {
          chainName = 'avalanche';
          result.tokenList.push({
            chainId: chainId,
            address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            name: 'Avalanche',
            symbol: 'AVAX',
            decimals: 18,
            logoURI: config.avalanche.logo_url
          });
          for (const tokenList_url of config.avalanche.tokenList_urls) {
            fetchList = fetchList.concat((await axios.get(tokenList_url)).data.tokens);
          }
          break;
        }
        case 250: {
          chainName = 'fantom';
          result.tokenList.push({
            chainId: chainId,
            address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            name: 'Fantom',
            symbol: 'FTM',
            decimals: 18,
            logoURI: config.fantom.logo_url
          });
          for (const tokenList_url of config.fantom.tokenList_urls) {
            fetchList = fetchList.concat((await axios.get(tokenList_url)).data.tokens);
          }
          break;
        }
        case 10: {
          chainName = 'optimism';
          result.tokenList.push({
            chainId: chainId,
            address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            name: 'Optimism_ETH',
            symbol: 'ETH',
            decimals: 18,
            logoURI: config.optimism.logo_url
          });
          for (const tokenList_url of config.optimism.tokenList_urls) {
            fetchList = fetchList.concat((await axios.get(tokenList_url)).data.tokens);
          }
          break;
        }
        case 42161: {
          chainName = 'arbitrum';
          result.tokenList.push({
            chainId: chainId,
            address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            name: 'Arbitrum_ETH',
            symbol: 'ETH',
            decimals: 18,
            logoURI: config.arbitrum.logo_url
          });
          for (const tokenList_url of config.arbitrum.tokenList_urls) {
            fetchList = fetchList.concat((await axios.get(tokenList_url)).data.tokens);
          }
          break;
        }
      }
      fetchList = fetchList.filter((obj) => obj.chainId === chainId || !obj.hasOwnProperty('chainId'));
      // 去重
      let list = [];
      fetchList = fetchList.filter((item) => !list.includes(item.address) && list.push(item.address));
      fetchList = fetchList.filter(
        (obj) =>
          ![
            '0x0000000000000000000000000000000000001010',
            '0x4200000000000000000000000000000000000042',
            '0x02a2b736F9150d36C0919F3aCEE8BA2A92FBBb40'
          ].includes(obj.address)
      );
      result.tokenList.push(...fetchList);
      result.tokenList.forEach((item) => {
        if (config[chainName].recommend.includes(item.symbol)) {
          item.isRecommended = true;
        } else {
          item.isRecommended = false;
        }
        if (item.logoURI) {
          item.logoURI = item.logoURI.replace(`/thumb/`, `/large/`);
          if (item.logoURI && item.logoURI.startsWith('ipfs')) {
            item.logoURI = Util.getIpfsPath(item.logoURI);
          }
        }
      });

      const index = result.tokenList.findIndex((item) => item.symbol === 'DAI');
      if (index > 1) {
        const element = result.tokenList.splice(index, 1)[0];
        result.tokenList.splice(1, 0, element);
      } // 第二位置默认为DAI

      result.total = result.tokenList.length;
      this.tokenListCache.set(`${cacheName}:${Number(chainId)}`, result);
      return result;
    } catch (err) {
      console.log(err);
      return result;
    }
  }
}

module.exports = AggregatorCommon;
