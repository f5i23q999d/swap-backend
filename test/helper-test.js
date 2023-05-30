const expect = require("chai").expect;
const { ethers } = require("ethers");
const ADDRESS = require('../helpers/constant/addresses');
const AaveV2Helper = require('../helpers/aavev2helper');
const UniswapV2helper = require('../helpers/uniswapv2helper');
const UniswapV3helper = require('../helpers/uniswapv3helper');
const Dodohelper = require('../helpers/dodohelper');
const config = require("..//config");
const provider = new ethers.providers.JsonRpcProvider(config.rpc);
const wallet = new ethers.Wallet(
    config.privateKey,
    provider
);
const signer = provider.getSigner(wallet.address);


describe('backend', () => {
  // it('should get quote from aavev2helper', async () => {
  //   const aavev2helper = new AaveV2helper();
  //   console.log(await aavev2helper.getOutputByExactInput(ADDRESS.DAI,ADDRESS.ADAI,1000000000000000000,null,50,signer));
  // });

  it('should get quote from uniswapv2helper', async () => {
    const uniswapV2helper = new UniswapV2helper();
    console.log(await uniswapV2helper.getOutputByExactInput(ADDRESS.DAI,ADDRESS.USDT,1000000000000000000,ADDRESS.VERSE_FACTORY,50,signer));
  });

  // it('should get quote from uniswapv3helper', async () => {
  //   const uniswapV3helper = new UniswapV3helper();
  //   console.log(await uniswapV3helper.getOutputByExactInput(ADDRESS.USDT,ADDRESS.USDC,"10000000000000",100,ADDRESS.V3QUOTE_V2,1,signer));
  // });

  // it('should get quote from Dodohelper', async () => {
  //   const dodohelper = new Dodohelper();
  //   //console.log(await dodohelper.getOutputByExactInput(ADDRESS.DAI,ADDRESS.USDT,"1000000000000000000",null,50,signer)); //1个DAI => USDT
  //   //console.log(await dodohelper.getOutputByExactInput(ADDRESS.USDT,ADDRESS.DAI,"1000000",null,50,signer)); //1个USDT => DAI
  //   //console.log(await dodohelper.getOutputByExactInput(ADDRESS.USDT,ADDRESS.USDC,"1000000",null,50,signer)); //1个USDT => USDC
  //   //console.log(await dodohelper.getOutputByExactInput(ADDRESS.WETH,ADDRESS.USDT,"1000000000000000000",null,10,signer)); //1个WETH => USDT
  //   //console.log(await dodohelper.tokenInfo(ADDRESS.WETH,ADDRESS.USDT,signer));

  //   console.log(await dodohelper.getOutputByExactInput(ADDRESS.ADAI,ADDRESS.AUSDC,"100000000",null,10,signer)); //1个WETH => USDT
  // });

});