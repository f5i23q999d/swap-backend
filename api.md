[路径]
/quote 

[method]
GET


[输入参数]
参数名称                     类型               必填       描述                   
source_token                string            √         要出售的代币的合约地址
target_token                string            √         要购买的代币的合约地址
amount                      integer           √         要出售的代币数量，以最小可分割单位设置， 例如1.00 DAI 设置成 1000000000000000000， 51.03 USDC 设置成 51030000
part                        integer                     计算路由时分成的部分数，默认20，最大50
slippage                    number                      交易滑点，默认0.5%  最大50%
sender_address              string            √         出售者的地址
receiver_address            string                      swap后代币的接受地址，默认是出售者的地址
depth                       integer                     计算路由时最大的计算深度，默认1
flag                        integer                     指定流动性协议。 如果未设置，将使用所有流动性协议; 目前以["SushiSwap", "ShibaSwap", "UniswapV2", "UniswapV3", "AaveV2", "Dodo"]为顺序，例如启用ShibaSwap和dodo则用二进制(100010)=42 表示


[输出参数]
参数名称                   类型                      描述                   
source_token              string                   要出售的代币的合约地址
target_token              string                   要购买的代币的合约地址
source_token_amount       integer                  输入的代币数量，以最小可分割单位设置
target_token_amount       integer                  返回的代币数量，以最小可分割单位设置
paths                     array                    描述交换路由路径
estimate_gas              integer                  预估的gas数量
estimate_cost             number                   预估的上链手续费
swaps                     array                    各个swap的展示信息
reception                 number                   返回金额，已经经过小数位处理
minimum_reception         number                   最少接受金额
price_impact              number                   价格影响
tx_data                   string                   这次swap操作需要发送的data


[输出样例]
{
  "source_token": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  "target_token": "0x6b175474e89094c44da98b954eedeac495271d0f",
  "source_token_amount": "1000000000000000000000",
  "target_token_amount": "1861069822039431109493954",
  "paths": [
    [
      [
        {
          "name": "CURVE_V2",
          "part": 24,
          "source_token": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          "target_token": "0xdac17f958d2ee523a2206206994597c13d831ec7"
        },
        {
          "name": "INTEGRAL",
          "part": 36,
          "source_token": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          "target_token": "0xdac17f958d2ee523a2206206994597c13d831ec7"
        },
        {
          "name": "UNISWAP_V3",
          "part": 40,
          "source_token": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          "target_token": "0xdac17f958d2ee523a2206206994597c13d831ec7"
        }
      ],
      [
        {
          "name": "BALANCER_V2",
          "part": 100,
          "source_token": "0xdac17f958d2ee523a2206206994597c13d831ec7",
          "target_token": "0x6b175474e89094c44da98b954eedeac495271d0f"
        }
      ]
    ],
    [
      [
        {
          "name": "PANCAKESWAP_V3",
          "part": 2,
          "fromTokenAddress": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          "target_token": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
        },
        {
          "name": "UNISWAP_V3",
          "part": 8,
          "source_token": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          "target_token": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
        },
        {
          "name": "INTEGRAL",
          "part": 14,
          "source_token": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          "target_token": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
        },
        {
          "name": "UNISWAP_V3",
          "part": 76,
          "source_token": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          "target_token": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
        }
      ],
      [
        {
          "name": "PSM",
          "part": 100,
          "source_token": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
          "target_token": "0x61861069b175474e890941861069c44da98b954eedeac495271d0f"
        }
      ]
    ]
  ],
  "estimate_gas": 2592087,
  "estimate_cost": 8.88,
  "swaps": [
    {"name":"FxSwap","price":1.000356,"youGet":1.000356,"fees":8.88},    
    {"name":"SushiSwap","price":0.994734,"youGet":0.994734,"fees":8.88},
    {"name":"ShibaSwap","price":0.944528,"youGet":0.944528,"fees":8.88},
    {"name":"UniswapV2","price":0.995375,"youGet":0.995375,"fees":8.88},
    {"name":"UniswapV3","price":0.999645,"youGet":0.999645,"fees":8.88},
    {"name":"AaveV2","price":0,"youGet":0,"fees":8.88},
    {"name":"Dodo","price":1.000356,"youGet":1.000356,"fees":8.88}],
  "minimum_reception": 1861069.81,
  "price_impact":  10.2,
  "tx_data":   "0x06ed9d2e0000000000000000000000000000000000000000000000000000000000000080000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4800000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000064000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000004635a010be2707a3fb9c3467fc615202468bc51e000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000c9f93163c99695c6526b799ebca2207fdf7d61ad000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001000000000000000000000000533da777aedce766ceae696bf90f8541a4ba80eb"
}

------------------------------------------------------------------------------------------------------------------------------------

[路径]
/chart 

[method]
GET

[输入参数]
参数名称                     类型               必填       描述                   
source_token                string            √         要出售的代币的合约地址
target_token                string            √         要购买的代币的合约地址
days                        integer                     图表范围，默认30天数据， 范围有[0.5,1,3,7,30]



[输出参数]
参数名称                   类型                      描述                   
diff                      number                   图表范围变化的幅度
chat                      array                    包含若干个对象，每个对象有timestamp和price两个属性



[输出样例]
{"chart":[{"timestamp":1684087200,"price":1797.56},{"timestamp":1684090800,"price":1801.8},{"timestamp":1684094400,"price":1801.55},{"timestamp":1684098000,"price":1802.48},{"timestamp":1684101600,"price":1792.69},{"timestamp":1684105200,"price":1803.87},{"timestamp":1684108800,"price":1787.22},{"timestamp":1684112400,"price":1827.9},{"timestamp":1684116000,"price":1829.63},{"timestamp":1684119600,"price":1834.17},{"timestamp":1684123200,"price":1830.05},{"timestamp":1684126800,"price":1817.16},{"timestamp":1684130400,"price":1834.77}],"diff":"2.07"}

------------------------------------------------------------------------------------------------------------------------------------

[路径]
/0x/sources

[描述]
返回所有支持的dex

[method]
GET

[输入参数]
参数名称                     类型               必填       描述                   
chainId                     number                      默认1，代表以太链

[输出样例]
{"sources":["0x","Aave_V2","Balancer","Balancer_V2","BancorV3","Compound","CryptoCom","Curve","Curve_V2","DODO","DODO_V2","KyberDMM","KyberElastic","Lido","MakerPsm","MultiHop","Saddle","ShibaSwap","SushiSwap","Synapse","Synthetix","Uniswap","Uniswap_V2","Uniswap_V3"],"total":24}

------------------------------------------------------------------------------------------------------------------------------------

[路径]
/0x/quote

[method]
GET

[输入参数]
参数名称                     类型               必填       描述                   
source_token                string            √         要出售的代币的合约地址
target_token                string            √         要购买的代币的合约地址
amount                      integer           √         要出售的代币数量，以最小可分割单位设置， 例如1.00 DAI 设置成 1000000000000000000， 51.03 USDC 设置成 51030000
side                        string                      指代amount是出售还是购入数量，当为BUY时，指的是要购买的数量，当为SELL时，指的是出售的数量
chainId                     number                      默认1，代表以太链
slippage                    number                      交易滑点
sender_address              string            √         出售者的地址
protocols                   string                      指定流动性协议。 如果未设置，将使用所有流动性协议; 每个protocol以逗号进行分隔

[输出样例]
{
    "source_token": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    "target_token": "0xdac17f958d2ee523a2206206994597c13d831ec7",
    "source_token_amount": "100000000000",
    "target_token_amount": "53275306576138572012",
    "minimumReceived": "53.00893004325787915194",
    "estimate_gas": "178766",
    "estimate_cost": "8.22844345358",
    "reception": "53.275306576138572012",
    "minimum_reception": "53.00893004325787915194",
    "price_impact": "0.0224",
    "tx_data": "0x3598d8ab0000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000174876e8000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002bc02aaa39b223fe8d0a0e5c4f27ead9083c756cc20001f4dac17f958d2ee523a2206206994597c13d831ec7000000000000000000000000000000000000000000869584cd00000000000000000000000010000000000000000000000000000000000000110000000000000000000000000000000000000000000000f22ce1fba264990a9d",
    "swaps": [
        {
            "name": "FxSwap",
            "price": "0.00053275306576138572012",
            "youGet": "53.275306576138572012",
            "fees": "8.22844345358"
        },
        {
            "name": "UniswapV2",
            "price": "0.00053595267479377834125",
            "youGet": "53.595267479377834125",
            "fees": "2.935527"
        },
        {
            "name": "UniswapV3",
            "price": "0.00053275306576138572012",
            "youGet": "53.275306576138572012",
            "fees": "5.256530"
        }
    ],
    "paths": [
        [
            [
                {
                    "name": "Uniswap_V3",
                    "part": 100,
                    "source_token": "0xdac17f958d2ee523a2206206994597c13d831ec7",
                    "target_token": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
                }
            ]
        ]
    ]
}

------------------------------------------------------------------------------------------------------------------------------------

[路径]
/tokens

[描述]
返回不同链的token列表

[method]
GET

[输入参数]
参数名称                     类型               必填       描述                   
chainId                     number                      默认1，代表以太链

[输出样例]
{"tokens":[
  {"chainId":10,"address":"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE","name":"Optimism","symbol":"OP","decimals":18,"logoURI":"https://file.fxwallet.com/token/2a53bc62dff62b5ee60e2297032990fc9bddf3b80c30e0a3ea8945d447a71cba.svg","isRecommended":true},
  {"chainId":10,"address":"0x1db2466d9f5e10d7090e7152b68d62703a2245f0","name":"Sonne Finance","symbol":"SONNE","decimals":18,"logoURI":"https://assets.coingecko.com/coins/images/27540/thumb/Token1.png?1664422231","isRecommended":false}],
  "total":2}

------------------------------------------------------------------------------------------------------------------------------------

[路径]
/0x/chains

[描述]
返回支持链的全称、logo链接以及chainId

[method]
GET

[输出样例]
{"chains":[{"name":"Ethereum","rpc":"https://rpc.ankr.com/eth","token":"ETH","logo_url":"https://file.fxwallet.com/token/49b2544d7b7a10418b5851aab81e0c1bc48e4138a4f3707bb4f3ea1a8cf26ec6.svg","chainId":"0x1"},{"name":"BNB Chain","rpc":"https://rpc.ankr.com/bsc","token":"BNB","logo_url":"https://file.fxwallet.com/token/62ad22a04becfde983e3c940113d356e84691c80a882d304840c8162cc8fc394.svg","chainId":"0x38"},{"name":"Polygon","rpc":"https://rpc.ankr.com/polygon","token":"MATIC","logo_url":"https://file.fxwallet.com/token/34ee6b70c50f3f2556796b3c79d3f76cc05c89ecec1bb5b12a6d6cbfae23e058.png","chainId":"0x89"},{"name":"Optimism","rpc":"https://rpc.ankr.com/optimism","token":"OP","logo_url":"https://file.fxwallet.com/token/2a53bc62dff62b5ee60e2297032990fc9bddf3b80c30e0a3ea8945d447a71cba.svg","chainId":"0xa"},{"name":"Arbitrum","rpc":"https://rpc.ankr.com/arbitrum","token":"ARB","logo_url":"https://file.fxwallet.com/token/cea438da55ced2ac65bea8d4aab84a3b53d723da7c0feed25446f9879ce1433e.svg","chainId":"0xa4b1"},{"name":"Avalanche","rpc":"https://rpc.ankr.com/avalanche","token":"AVAX","logo_url":"https://file.fxwallet.com/1679972090672-avax.png","chainId":"0xa86a"},{"name":"Fantom","rpc":"https://rpc.ankr.com/fantom","token":"FTM","logo_url":"https://file.fxwallet.com/default/1683530682226-ftm.png","chainId":"0xfa"}],"total":7}
