const express = require('express');
const { ethers } = require('ethers');
const app = express();
const config = require('../config');
const port = config.port;
const provider = new ethers.providers.JsonRpcProvider(config.rpc);
const wallet = new ethers.Wallet('0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d', provider);
const ERC20ABI = require('../helpers/abi/ERC20.json');
const ADAI_ADDRESS = '0x028171bCA77440897B824Ca71D1c56caC55b68A3';
const axios = require('axios');
const ADDRESS = require('../helpers/constant/addresses.js');
const _USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const _DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const chainId = 1;

async function test() {
    //  1 ETH => USDT
    // 先node start.js启动服务
    const quote1 = await axios.get('http://localhost:3000/0x/quote', {
        params: {
            source_token: ADDRESS.ETH,
            target_token: _USDT,
            amount: String(1e18),
            slippage: 100,
            address: ADDRESS.WALLET,
            chainId
        }
    });

    const USDT = new ethers.Contract(_USDT, ERC20ABI, wallet);

    const defaultAddress = wallet.address;
    console.log('Before ETH balance:	', (await wallet.getBalance()) / 1e18);
    console.log('Before USDT balance:	', (await USDT.balanceOf(defaultAddress)) / 1e6);

    const tx = {
        to: quote1.data.to,
        data: quote1.data.tx_data,
        value: ethers.utils.parseEther('1.0')
    };
    console.log(await wallet.sendTransaction(tx));
    console.log('After ETH balance:	', (await wallet.getBalance()) / 1e18);
    console.log('After USDT balance:	', (await USDT.balanceOf(defaultAddress)) / 1e6);

    //  USDT => DAI
    const quote2 = await axios.get('http://localhost:3000/0x/quote', {
        params: {
            source_token: _USDT,
            target_token: _DAI,
            amount: String(1e5),
            slippage: 100,
            address: ADDRESS.WALLET,
            chainId
        }
    });
    const tx2 = {
        to: quote2.data.to,
        data: quote2.data.tx_data
    };
    const rep = await USDT.approve(quote2.data.to, String(1e5));
    await rep.wait();
    console.log(await wallet.sendTransaction(tx2));
    const DAI = new ethers.Contract(_DAI, ERC20ABI, wallet);

    console.log('After USDT balance:	', (await USDT.balanceOf(defaultAddress)) / 1e6);
    console.log('After DAI balance:	', (await DAI.balanceOf(defaultAddress)) / 1e18);
    return;
}

test();
