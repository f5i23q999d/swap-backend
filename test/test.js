const express = require("express");
const { ethers } = require("ethers");
const app = express();
const config = require("../config.js");
const port = config.port;
const provider = new ethers.providers.JsonRpcProvider(config.rpc);
const wallet = new ethers.Wallet(
    "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d",
    provider
);
const ERC20ABI = require("../helpers/abi/ERC20.json");
const ADAI_ADDRESS = "0x028171bCA77440897B824Ca71D1c56caC55b68A3";
const axios = require('axios');
const ADDRESS = require("../helpers/constant/addresses.js");
async function test(){
    const ADAI = new ethers.Contract(ADAI_ADDRESS, ERC20ABI, wallet);
    console.log((await ADAI.balanceOf(wallet.address)).toString());
    await ADAI.approve(config.FXSWAP_ADDRESS,String(1e18));
    const tx = {
        to : config.FXSWAP_ADDRESS,
        data : "0x06ed9d2e0000000000000000000000000000000000000000000000000000000000000080000000000000000000000000028171bca77440897b824ca71d1c56cac55b68a3000000000000000000000000bcca60bb61934080951369a648fb03df4f96263c0000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000026000000000000000000000000000000000000000000000000000000000000004e0000000000000000000000000028171bca77440897b824ca71d1c56cac55b68a30000000000000000000000006b175474e89094c44da98b954eedeac495271d0f0000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000e06d76d72db4a9763592f4ae741c662edbe8902c00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080000000000000000000000000028171bca77440897b824ca71d1c56cac55b68a30000000000000000000000006b175474e89094c44da98b954eedeac495271d0f0000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000006b175474e89094c44da98b954eedeac495271d0f000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000b3f25e96f34ccd7f21ee58272308513b4e0633e400000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000100000000000000000000000000e592427a0aece92de3edee1f18e0157c058615640000000000000000000000006b175474e89094c44da98b954eedeac495271d0f000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000000000000000000000000000000000000000000000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000bb80000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000bcca60bb61934080951369a648fb03df4f96263c000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000e06d76d72db4a9763592f4ae741c662edbe8902c00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000bcca60bb61934080951369a648fb03df4f96263c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002",
        gasLimit: "0xffffff",
    };    
    await wallet.sendTransaction(tx);
    console.log((await ADAI.balanceOf(wallet.address)).toString());

    return;
}


async function test2(){ //  1 ETH => USDT
    // 先node start.js启动服务
    
    const result = await axios.get('http://localhost:3000/quote',{       //如果是测试网，改成http://8.212.8.124:8546/quote   
            params: {
                source_token: ADDRESS.ETH,
                target_token: ADDRESS.USDT,
                amount: String(1e18),
                part: 10,
                slippage: 10,   // 1-500 ->0.1%->50%
                address: ADDRESS.WALLET,
                receiver_address: ADDRESS.WALLET,
                depth: 1
            }          
    });


    const USDT = new ethers.Contract(ADDRESS.USDT, ERC20ABI, wallet);

    const defaultAddress = wallet.address;
	console.log('Before ETH balance:	', (await wallet.getBalance())/1e18);
	console.log('Before USDT balance:	', (await USDT.balanceOf(defaultAddress))/1e6);

    const tx = {
        to : config.FXSWAP_ADDRESS,
        data : result.data.tx_data,
        gasLimit: "0xffffff",
       value : ethers.utils.parseEther("1.0")
    };    
    console.log(await wallet.sendTransaction(tx));

    


    console.log('After ETH balance:	', (await wallet.getBalance())/1e18);
	console.log('After USDT balance:	', (await USDT.balanceOf(defaultAddress))/1e6);

    return;
}


async function test3(){ //  100 USDT => ETH
    // 先node start.js启动服务

    const result = await axios.get('http://localhost:3000/quote',{        
            params: {
                source_token: ADDRESS.USDT,
                target_token: ADDRESS.ETH,
                amount: String(100e6),   // 100 USDT
                part: 10,
                slippage: 10,   // 1-500 ->0.1%->50%
                address: ADDRESS.WALLET,
                receiver_address: ADDRESS.WALLET,
                depth: 1
            }          
    });

    const USDT = new ethers.Contract(ADDRESS.USDT, ERC20ABI, wallet);
    const defaultAddress = wallet.address;
	console.log('Before ETH balance:	', (await wallet.getBalance())/1e18);
	console.log('Before USDT balance:	', (await USDT.balanceOf(defaultAddress))/1e6);

    await USDT.approve(config.FXSWAP_ADDRESS, String(0));  // 重置授权
    await USDT.approve(config.FXSWAP_ADDRESS, String(100e6));
    const tx = {
        to : config.FXSWAP_ADDRESS,
        data : result.data.tx_data,    
    };    
    console.log(await wallet.sendTransaction(tx));    


    console.log('After ETH balance:	', (await wallet.getBalance())/1e18);
	console.log('After USDT balance:	', (await USDT.balanceOf(defaultAddress))/1e6);

    return;
}


async function test4(){ //  1 USDT => DAI
    // 先node start.js启动服务

    const result = await axios.get('http://localhost:3000/quote',{        
            params: {
                source_token: ADDRESS.USDT,
                target_token: ADDRESS.DAI,
                amount: String(100e6),   // 100 USDT
                part: 10,
                slippage: 10,   // 1-500 ->0.1%->50%
                address: ADDRESS.WALLET,
                receiver_address: ADDRESS.WALLET,
                depth: 1
            }          
    });

    const USDT = new ethers.Contract(ADDRESS.USDT, ERC20ABI, wallet);
    const DAI = new ethers.Contract(ADDRESS.DAI, ERC20ABI, wallet);
    const defaultAddress = wallet.address;
	console.log('Before DAI balance:	', (await DAI.balanceOf(defaultAddress))/1e18);
	console.log('Before USDT balance:	', (await USDT.balanceOf(defaultAddress))/1e6);

    await USDT.approve(config.FXSWAP_ADDRESS, String(0));  // 重置授权
    await USDT.approve(config.FXSWAP_ADDRESS, String(100e6));
    const tx = {
        to : config.FXSWAP_ADDRESS,
        data : result.data.tx_data,    
    };    
    console.log(await wallet.sendTransaction(tx));    


	console.log('After DAI balance:	', (await DAI.balanceOf(defaultAddress))/1e18);
	console.log('After USDT balance:	', (await USDT.balanceOf(defaultAddress))/1e6);

    return;
}


async function test5(){ //  1 ETH => PEPE
    // 先node start.js启动服务
    
    const result = await axios.get('http://localhost:3000/quote',{       //如果是测试网，改成http://8.212.8.124:8546/quote   
            params: {
                source_token: ADDRESS.ETH,
                target_token: ADDRESS.PEPE,
                amount: String(1e18),
                part: 10,
                slippage: 10,   // 1-500 ->0.1%->50%
                address: ADDRESS.WALLET,
                receiver_address: ADDRESS.WALLET,
                depth: 1
            }          
    });


    const PEPE = new ethers.Contract(ADDRESS.PEPE, ERC20ABI, wallet);

    const defaultAddress = wallet.address;
	console.log('Before ETH balance:	', (await wallet.getBalance())/1e18);
	console.log('Before USDT balance:	', (await PEPE.balanceOf(defaultAddress))/1e18);

    const tx = {
        to : config.FXSWAP_ADDRESS,
        data : result.data.tx_data,
       value : ethers.utils.parseEther("1.0")
    };    
    console.log(await wallet.sendTransaction(tx));

    


    console.log('After ETH balance:	', (await wallet.getBalance())/1e18);
	console.log('After PEPE balance:	', (await PEPE.balanceOf(defaultAddress))/1e18);

    return;
}

 test2()
