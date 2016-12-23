![alt text](https://raw.githubusercontent.com/navcoindev/navcoin-media/master/logo/logo-extended.png "Logo text 2")

# NAVTECH

## RECOMMENDED SPECIFICATIONS

- To start up a NAVTech cluster, you will need a minimum of 2 servers with the following specifications each with their own IP Adddress and have the correct ports open for the API.

| Component | Value |
|:-----|:-----|
| CPU | 2 x 2.4 Ghz Intel Xeon |
| RAM | 2 GB |
| Hard Disk | 40GB |
| Operating System | 64bit Debian or Ubuntu |
| API Port | 3000 |

## SETUP STEPS

### SETUP NAVCOIN AND SUBCHAIN

- Download and compile both the navcoind & subchaind daemons. These each have their own setup steps and you will need to refer to their individual readme files.

https://github.com/navcoindev/navcoin2/tree/master

https://github.com/navcoindev/subchain/tree/master

- Stop navcoind and navajoanonsubchaind if they are running
```
./navcoind stop
./navajoanonsubchaind stop
```

- Configure your navcoin conf file to have valid rpc credentials. Passwords should be a-z, A-Z and 0-9. The use of some symbols causes the RPC connection to fail so it is recommended to avoid them all together.
``` sh
vi ~/.navcoin2/navcoin.conf
```
```
rpcuser=<NAVCOIN_RPC_USERNAME>
rpcpassword=<NAVCOIN_RPC_PASSWORD>
```
- Configure your navajoanonsubchain conf file to have valid rpc credentials. Passwords should be a-z, A-Z and 0-9. The use of some symbols causes the RPC connection to fail so it is recommended to avoid them all together.
``` sh
vi ~/.navajoanonsubchain/navajoanonsubchain.conf
```
```
rpcuser=<SUBCHAIN_RPC_USERNAME>
rpcpassword=<SUBCHAIN_RPC_PASSWORD>
```
- Start navcoind and navajoanonsubchaind back up again with the new rpc details
```
./navcoind
./navajoanonsubchaind
```

- Make sure that both Nav Coin and the Subchain are fully synced before attempting the setup steps.

### INSTALL TOOLS AND DOWNLOAD SOURCE
- If you don't have git or npm installed, please install them.
``` sh
sudo apt-get update
sudo apt-get install git npm
```
- Install nodejs v 6.3.1 using the following commands
``` sh
curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
```
The node -v command should show v6.3.1 if this doesnt work, please consult the nodejs website on how to install this version.

- Clone the crypto-anonymizer ropo into the folder you want to run the code from with the command
``` sh
git clone https://github.com/navcoindev/navtech.git
```
### SETUP INCOMING SERVER
- On the incoming server open the config folder and copy the incoming settings example to what will be your local settings file and open it
``` sh
cd navtech/config
cp example-incoming.default.json default.json
vi default.json
```
- This file determines all the settings necessary to operate your incoming NAVTech Server. You will need to configure this to your own settings.

Here are the detailed explaination of what the settings control and their defaults:

| Name | Type | Required | Default | Description |
|:-----|:-----|:-----|:-----|:-----|
| `GLOBAL` | `object`      | true    | `none` | contains the global settings which control how your server operates |
| `GLOBAL.serverType` | `string`      | true    | `INCOMING` | determines if your server is of incoming or outgoing type |
| `GLOBAL.encryptedWallet` | `boolean`      | true    | `false` | flag for if the NavCoin and Subchain wallets are encrypted  |
| `GLOBAL.maintenance` | `boolean`      | false    | `false` | flag to turn your wallet to maintenance mode and restrict IP access  |
| `GLOBAL.allowedIps` | `array`      | false    | `none` | array of allowed ip addresses when server is in maintenance mode  |
| `GLOBAL.allowedIps[n]`       | `string`      | false    | `none` | ip address to allow for maintenance testing |
| `INCOMING` | `object`      | true    | `none` | contains all the settings which are unique to incoming servers |
| `INCOMING.local`       | `object`      | true    | `none` | contains the address information of the local (incoming) server |
| `INCOMING.local.ipAddress` |  `string` | true | `none` | IP address of the local server |
| `INCOMING.local.port` |  `string` | true | 3000 | port of the local server |
| `INCOMING.local.host` |  `string` | false | `none` | optional dns name of the local server |
| `INCOMING.remote`       | `array`      | true    | `none` | contains the settings object of each (outgoing) server in the cluster |
| `INCOMING.remote[n]`       | `object`      | true    | `none` | contains the address information of a single remote (outgoing) server in the cluster |
| `INCOMING.remote[n].ipAddress` |  `string` | true | `none` | IP address of the remote server |
| `INCOMING.remote[n].port` |  `string` | true | 3000 | port of the remote server |
| `INCOMING.remote[n].host` |  `string` | false | `none` | optional dns name of the remote server |
| `INCOMING.scriptInterval` |  `int` | true | 120000 | time in milliseconds between each transaction processing cycle |
| `INCOMING.minAmount` |  `int` | true | 10 | minimum transaction size the server will accept |
| `INCOMING.maxAmount` |  `int` | true | 10000 | maximum transaction size the server will accept |
| `INCOMING.anonFeePercent` |  `float` | true | 0.5 | percentage taken as the server transaction fee, must be between 0 - 100. |
| `INCOMING.notificationEmail` |  `string` | true | `none` | email address error notifications will be sent to |
| `INCOMING.smtp`       | `object`      | true    | `none` | contains the settings to send notification emails via smtp |
| `INCOMING.smtp.user`       | `string`      | true    | `none` | username for sending mail via smtp |
| `INCOMING.smtp.pass`       | `string`      | true    | `none` | password for sending mail via smtp |
| `INCOMING.smtp.server`       | `string`      | true    | `none` | server for sending mail via smtp |
| `INCOMING.navCoin`       | `object`      | true    | `none` | contains the settings for the navcoin daemon |
| `INCOMING.navCoin.user`       | `string`      | true    | `none` | rpcusername set in the navcoin.conf file |
| `INCOMING.navCoin.pass`       | `string`      | true    | `none` | rpcpassword set in the navcoin.conf file |
| `INCOMING.navCoin.ip`       | `string`      | true    | '127.0.0.1' | ip address where navcoind is running |
| `INCOMING.navCoin.port`       | `string`      | true    | '44444' | port navcoind is running on |
| `INCOMING.navCoin.walletPassphrase`       | `string`      | `conditional|encryptedWallet`    | `none` | walletpassphrase to use to unlock the wallet for transactions. If the wallet is unencrypted, this will be used to encrypt it during setup |
| `INCOMING.subChain`       | `object`      | true    | `none` | contains the settings for the subchain daemon |
| `INCOMING.subChain.user`       | `string`      | true    | `none` | rpcusername set in the navajoanonsubchain.conf file |
| `INCOMING.subChain.pass`       | `string`      | true    | `none` | rpcpassword set in the navajoanonsubchain.conf file |
| `INCOMING.subChain.ip`       | `string`      | true    | '127.0.0.1' | ip address where navajoanonsubchain is running |
| `INCOMING.subChain.port`       | `string`      | true    | '44444' | port navajoanonsubchaind is running on |
| `INCOMING.subChain.walletPassphrase`       | `string`      | `conditional|encryptedWallet`   | `none` | walletpassphrase to use to unlock the wallet for transactions. If the wallet is unencrypted, this will be used to encrypt it during setup |
| `INCOMING.secretOptions`       | `object`      | true    | `none` | contains the options for creating the shared secret |
| `INCOMING.secretOptions.salt`       | `string`      | true    | `none` | any string to create randomness in the secret, recommended 20 characters |
| `INCOMING.secretOptions.saltRounds`       | `int`      | true    | 10 | number of times to salt the sercret |
| `INCOMING.secret`       | `string`      | true    | `none` | this is the secret shared between the incoming and outgoing server pair. This will be generated during the setup process  |
| `OUTGOING` | `boolean`      | true    | `false` | explicit flag to confirm that this is not an outgoing server |

- Please note that it is not recommended to run using an encrypted Nav Coin or Subchain wallet. During testing this cause some errors to be thrown when processing high volume transactions.

## RUNNING THE INCOMING SETUP SCRIPTS

Now the configuration is done, we need to perform the setup operations from the project root directory.

- First thing is to clean and install the npm modules, so change directory to the root of he project and run these commands:
``` sh
rm -rf node_modules
npm cache clean
npm install
```
- Make the folders for the generated RSA keys to be stored in
``` sh
mkdir keys keys/private keys/public
```
- Then run the setup command
``` sh
npm run setup
```
  * If your navcoin wallet was unencrypted and you've set the global encryptedWallet flag to `true` it will encrypt the wallet with the walletpassphrase you set in the incoming settings file and ask you to restart navcoind. Then run the setup again
``` sh
npm run setup
```
  * If your subchain wallet was unencrypted and you've set the global encryptedWallet flag to `true` it will encrypt the wallet with the walletpassphrase you set in the incoming settings file and ask you to restart navajoanonsubchaind. Then run the setup again
``` sh
npm run setup
```
- If your navcoin and subchain were already encrypted or they were encrypted using the steps above, your wallet will now begin to generate a pool of Nav Coin and Subchain addresses to use for transactions. You should see status messages appear with wallet addresses. Wait for this process to complete.

- After generating the addresses, it should also output the generated secret and let you know that the operation was successful. Please copy the secret, re-open the incoming settings file and paste it as the value for the property `secret` eg.
``` sh
vi config/default.js
```
``` js
...
secret: '$2a$10$u17OImuiUFGuhkvkeEV/3.5Npk3djKdxce0',
...
```
- You have the option of running the compiled version of NAVTech which we release or building your own. If you are happy to run what we have distributed then skip this step otherwise, run the following command to build your version:
``` sh
npm run build
```

- This should generate 2 files in the /dist directory: navtech.js and vendor.js

- The vendor file links to all the included libraries while the navtech file is the compressed and uglified version of the navtech anon processing scripts.

- We recommend using a service called forever js to manage the navtech server for you. It will restart the application if it were to crash and also consolidate and version any error logs which are produced.
``` sh
npm install -g forever
```
- Start the incoming server and check there were no problems
``` sh
forever start dist/navtech.js
```

- This should send a test email to your selected notification email address to make sure that is working. Then check the logs.
``` sh
forever logs 0
```
- The logs which are displayed should simply let you know the server has started. If this is the first server you have setup it will also report it was unable to contact an outgoing server. You can test the server is running by opening your browser and navigating to your server's IP address and port eg. https://95.183.53.184:3000

- We use generated unsigned SSL certificates, so proceed past the invalid SSL certificate and you should see a response like:
```
{"status":200,"type":"SUCCESS","message":"server is running!", "anonhash": "e0396962abef360221920beec1c08c18"}
```

- If you see this message, your incoming server is ready to accept transactions. The anonhash parameter is what you need to enter into your navcoin.conf file before trying to send anon transactions to this server. This hash will change as new versions of the software are released, so it will not be exactly what is listed in here. This is what the server sends to your wallet to confirm validty of the code it is running.
```
anonhash=e0396962abef360221920beec1c08c18
```

- Now we need to send the incoming server subchain coins to send to the outgoing server. First, get an account address
```
./navajoanonsubchaind getaccountaddress incomingAccount
```

- And send subchain coins to the echoed address split into 1000 SUB transactions. The reason why we split it up is because a wallet can only spend (and receive change from) a transaction once per block. So if we had all our SUB in 1 transaction to start with the server would have trouble processing more than 1 transaction at a time.
```
./navajoanonsubchaind sendtoaddress SgYPEy3RndRgdPVAWT7FiAkFEyjekLgaeb 1000
```

### SETUP OUTGOING SERVER

Setting up the outgoing server is much the same process as the incoming server but with some different settings.

- Repeat the steps under headings: `SETUP NAVCOIN AND SUBCHAIN` and `INSTALL TOOLS AND DOWNLOAD SOURCE`

- On the outgoing server open the config folder and copy the outgoing settings example to what will be your local settings file and open it
``` sh
cd navtech/config
cp example-outgoing.default.json default.json
vi default.json
```
- This file determines all the settings necessary to operate your outgoing NAVTech Server. You will need to configure this to your own settings.

Here are the detailed explaination of what the settings control and their defaults:

| Name | Type | Required | Default | Description |
|:-----|:-----|:-----|:-----|:-----|
| `GLOBAL` | `object`      | true    | `none` | contains the global settings which control how your server operates |
| `GLOBAL.serverType` | `string`      | true    | `INCOMING` | determines if your server is of incoming or outgoing type |
| `GLOBAL.encryptedWallet` | `boolean`      | true    | `false` | flag for if the NavCoin and Subchain wallets are encrypted  |
| `OUTGOING.local`       | `object`      | true    | `none` | contains the address information of the local (outgoing) server |
| `OUTGOING.local.ipAddress` |  `string` | true | `none` | IP address of the local server |
| `OUTGOING.local.port` |  `string` | true | 3000 | port of the local server |
| `OUTGOING.local.host` |  `string` | false | `none` | optional dns name of the local server |
| `OUTGOING.remote`       | `array`      | true    | `none` | contains the settings object of each (incoming) server in the cluster |
| `OUTGOING.remote[n]`       | `object`      | true    | `none` | contains the address information of a single remote (incoming) server in the cluster |
| `OUTGOING.remote[n].ipAddress` |  `string` | true | `none` | IP address of the remote server |
| `OUTGOING.remote[n].port` |  `string` | true | 3000 | port of the remote server |
| `OUTGOING.remote[n].host` |  `string` | false | `none` | optional dns name of the remote server |
| `OUTGOING.scriptInterval` |  `int` | true | 120000 | time in milliseconds between each transaction processing cycle |
| `OUTGOING.minAmount` |  `int` | true | 10 | minimum transaction size the server will accept |
| `OUTGOING.maxAmount` |  `int` | true | 10000 | maximum transaction size the server will accept |
| `OUTGOING.navPoolAmount` |  `int` | true | 50000 | the size of the NAV pool, all funds exceeding this value get sent to the NAVTech fee address |
| `OUTGOING.anonTxFeeAddress` |  `string` | true | `none` | NAV address used to collect the server processing fee. |
| `OUTGOING.notificationEmail` |  `string` | true | `none` | email address error notifications will be sent to |
| `OUTGOING.smtp`       | `object`      | true    | `none` | contains the settings to send notification emails via smtp |
| `OUTGOING.smtp.user`       | `string`      | true    | `none` | username for sending mail via smtp |
| `OUTGOING.smtp.pass`       | `string`      | true    | `none` | password for sending mail via smtp |
| `OUTGOING.smtp.server`       | `string`      | true    | `none` | server for sending mail via smtp |
| `OUTGOING.navCoin`       | `object`      | true    | `none` | contains the settings for the navcoin daemon |
| `OUTGOING.navCoin.user`       | `string`      | true    | `none` | rpcusername set in the navcoin.conf file |
| `OUTGOING.navCoin.pass`       | `string`      | true    | `none` | rpcpassword set in the navcoin.conf file |
| `OUTGOING.navCoin.ip`       | `string`      | true    | '127.0.0.1' | ip address where navcoind is running |
| `OUTGOING.navCoin.port`       | `string`      | true    | '44444' | port navcoind is running on |
| `OUTGOING.navCoin.walletPassphrase`       | `string`      | `conditional|encryptedWallet`    | `none` | walletpassphrase to use to unlock the wallet for transactions. If the wallet is unencrypted, this will be used to encrypt it during setup |
| `OUTGOING.subChain`       | `object`      | true    | `none` | contains the settings for the subchain daemon |
| `OUTGOING.subChain.user`       | `string`      | true    | `none` | rpcusername set in the navajoanonsubchain.conf file |
| `OUTGOING.subChain.pass`       | `string`      | true    | `none` | rpcpassword set in the navajoanonsubchain.conf file |
| `OUTGOING.subChain.ip`       | `string`      | true    | '127.0.0.1' | ip address where navajoanonsubchain is running |
| `OUTGOING.subChain.port`       | `string`      | true    | '44444' | port navajoanonsubchaind is running on |
| `OUTGOING.subChain.walletPassphrase`       | `string`      | `conditional|encryptedWallet`    | `none` | walletpassphrase to use to unlock the wallet for transactions. If the wallet is unencrypted, this will be used to encrypt it during setup |
| `OUTGOING.secret`       | `string`      | true    | `none` | this is the secret shared between the incoming and outgoing server pair. This needs to match the sercret used in the incoming server settings that was generated by running 'npm run setup' on the incoming server  |
| `INCOMING` | `boolean`      | true    | `false` | explicit flag to confirm that this is not an incoming server |

This is very similar to the incoming serer, however please note that in this instance the local server refers to the outgoing server since this is the server we are configuring and the remotes are the incoming servers in your cluster. The secret will not be generated by this server type, it needs to be copied from the incoming server. All servers in the same cluster must share the same secret.

## RUNNING THE OUTGOING SETUP SCRIPTS

Now the configuration is done, we need to perform the setup operations from the project root directory.

- First thing is to clean and install the npm modules, so change directory to the root of he project and run these commands:
``` sh
rm -rf node_modules
npm cache clean
npm install
```
- Make the folders for the generated RSA keys to be stored in
``` sh
mkdir keys keys/private keys/public
```
- Then run the setup command
``` sh
npm run setup
```
  * If your navcoin wallet was unencrypted and you've set the global encryptedWallet flag to `true` it will encrypt the wallet with the walletpassphrase you set in the incoming settings file and ask you to restart navcoind. Then run the setup again
``` sh
npm run setup
```
  * If your subchain wallet was unencrypted and you've set the global encryptedWallet flag to `true` it will encrypt the wallet with the walletpassphrase you set in the incoming settings file and ask you to restart navajoanonsubchaind. Then run the setup again
``` sh
npm run setup
```
- If your navcoin and subchain were already encrypted or they were encrypted using the steps above, your wallet will now begin to generate a pool of Nav Coin and Subchain addresses to use for transactions. You should see status messages appear with wallet addresses. Wait for this process to complete.

- After generating the addresses, it should let you know that the operation was successful.

- You have the option of running the compiled version of NAVTech which we release or building your own. If you are happy to run what we have distributed then skip this step otherwise, run the following command to build your version:
``` sh
npm run build
```
This should generate 2 files in the /dist directory: navtech.js and vendor.js

The vendor file links to all the included libraries while the navtech file is the compressed and uglified version of the navtech anon processing scripts.

- We recommend using a service called forever js to manage the navtech server for you. It will restart the application if it were to crash and also consolidate and version any error logs which are produced.
``` sh
npm install -g forever
```
- Start the outgoing server and check there were no problems
``` sh
forever start dist/navtech.js
```

- This should send a test email to your selected notification email address to make sure that is working. Then check the logs.
``` sh
forever logs 0
```
- The logs which are displayed should simply let you know the server has started. If this is the first server you have setup it will also report it was unable to contact an outgoing server. You can test the server is running by opening your browser and navigating to your server's IP address and port eg. https://5.230.146.212:3000

- We use generated unsigned SSL certificates, so proceed past the invalid SSL certificate and you should see a response like:
```
{"status":200,"type":"SUCCESS","message":"server is running!", "anonhash": "e0396962abef360221920beec1c08c18"}
```
If you see this message, your outgoing server is ready to accept transactions.

- Now we need to send the outgoing server Nav Coins to send to the outgoing server. First, get an account address
```
./navcoind getaccountaddress outgoingAccount
```

- And send NAV to the echoed address split into 1000 NAV transactions to the maximum value of the pool size you specified. The reason why we split it up is because a wallet can only spend (and receive change from) a transaction once per block. So if we had all our NAV in 1 transaction to start with the server would have trouble processing more than 1 transaction at a time.
```
./navcoind sendtoaddress NgzWzvQBk6o18nsEFoh6Ub53U6eg1qvtFu 1000
```

# ADDITIONAL NOTES

Now you have both servers setup, it is time to send some test transactions. Make sure you put the correct IP addresses, port number and anonhash parameter into your navcoin.conf file and send some small value test transactions though your NAVTech servers.

If you are happy with your configuration and transactions are processing successfully you will want to remove the GLOBAL.maintenance and GLOBAL.allowedIps settings from your config/default.js file so the servers are open for public use.

Then head along to http://reddit.com/r/NAVTechAnon and submit your servers for public use.

## MULTIPLE INCOMING AND OUTGOING SERVERS

If you want to setup multiple incoming and outgoing servers in your cluster the setup process is the same for each one. The only extra things you will need to remember are to add all your outgoing servers to the INCOMING.remote arrays and all your incoming servers to your OUTGOING.remote arrays so the servers can all talk to eachother.

## RESTARTING SERVERS

There should be some caution taken when restarting the NAVTech service or restarting the server. The chances are very small because the transaction cycle completes pretty quickly, but it is not recommended to shut the server down while it is in the act of processing transactions. I have created an endpoint to see the server status so you can choose a time between cycles to stop the service

https://95.183.53.184:3000/api/status

It shows whether the server is currently processing, is paused and the time till the next cycle is due to start.

This should give you ample information to be able to gracefully shut the server down between cycles using the forever command.
``` sh
forever stop 0
```
