# 路由后台
使用以下命令安装依赖：
```shell
npm install
```

修改配置文件config.js中的rpcs.eth为：
```shell
http://8.212.8.124:8545
```

使用以下命令启动服务：
```shell
node start.js
```

测试链接（启动服务后可以浏览器打开测试）：
```shell
http://localhost:3000/quote?source_token=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&target_token=0xBcca60bB61934080951369a648Fb03DF4F96263C&amount=1000000000000000000&part=50&slippage=5&address=0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1&&depth=1
```

使用以下命令测试helper：
```shell
mocha
```
使用以下命令测试完整流程（需先启动服务）：
```shell
node ./test/test.js
```

0x测试链接（启动服务后可以浏览器打开测试）：
```shell
http://localhost:3000/0x/quote?source_token=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&target_token=0xdac17f958d2ee523a2206206994597c13d831ec7&amount=1000000000000000000000&slippage=5
```



统一接口测试链接（启动服务后可以浏览器打开测试）：
```shell
http://localhost:3000/union/quote?source_token=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&target_token=0xdac17f958d2ee523a2206206994597c13d831ec7&amount=11000000000000000000000&slippage=5&protocols=1inch&sender_address=0x163DCfD778c9c73B2d1444b6166DabB27182aD4c
```

