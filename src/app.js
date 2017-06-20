'use strict'

const Client = require('bitcoin-core')
const express = require('express')
const https = require('https')
const pem = require('pem')
const bodyParser = require('body-parser')
const fs = require('fs')
const config = require('config')
const md5File = require('md5-file')

const IncomingServer = require('./incoming')
const OutgoingServer = require('./outgoing')
const SettingsValidator = require('./lib/SettingsValidator.js')
const NavCoin = require('./lib/NavCoin.js')
const EncryptedData = require('./lib/EncryptedData.js')
const RandomizeTransactions = require('./lib/RandomizeTransactions.js')
const EncryptionKeys = require('./lib/EncryptionKeys.js')
const Logger = require('./lib/Logger.js')

// -------- Settings -----------------------------------------------------------

const privateSettings = require('./settings/private.settings')
const globalSettings = config.get('GLOBAL')

let settings = false
if (globalSettings.serverType === 'INCOMING') settings = config.get('INCOMING')
if (globalSettings.serverType === 'OUTGOING') settings = config.get('OUTGOING')

// --------- Initialisation ----------------------------------------------------

Logger.writeLog('SYS_001', 'Server Starting', {
  memes: ['harambe', 'rustled jimmies'],
}, true)

const app = express()

const NavtechApi = {}

if (settings) {
  SettingsValidator.validateSettings({ settings }, canInit)
} else {
  Logger.writeLog('APP_001', 'invalid global server type', globalSettings.serverType)
}

function canInit(settingsValid) {
  if (settingsValid) {
    initServer()
  } else {
    Logger.writeLog('APP_002', 'invalid server settings', settings)
  }
}

function initServer() {
  NavtechApi.navClient = new Client({
    username: settings.navCoin.user,
    password: settings.navCoin.pass,
    port: settings.navCoin.port,
    host: settings.navCoin.host,
  })

  NavtechApi.subClient = new Client({
    username: settings.subChain.user,
    password: settings.subChain.pass,
    port: settings.subChain.port,
    host: settings.subChain.host,
  })

  if (settings.ssl) {
    fs.exists(settings.ssl.key, (keyExists) => {
      fs.exists(settings.ssl.crt, (certExists) => {
        if (!keyExists || !certExists) {
          Logger.writeLog('APP_003', 'unable to find user defined ssl certificate', settings.ssl)
          return
        }
        const sslOptions = {
          key: fs.readFileSync(settings.ssl.key),
          cert: fs.readFileSync(settings.ssl.crt),
          requestCert: false,
          rejectUnauthorized: false,
        }
        app.use(bodyParser.json())
        app.use(bodyParser.urlencoded({
          extended: true,
        }))

        https.createServer(sslOptions, app).listen(settings.local.port, () => {
          setupServer()
        })
      })
    })
  } else {
    pem.createCertificate({ days: 1, selfSigned: true }, (err, keys) => {
      const sslOptions = {
        key: keys.serviceKey,
        cert: keys.certificate,
        requestCert: false,
        rejectUnauthorized: false,
      }
      app.use(bodyParser.json())
      app.use(bodyParser.urlencoded({
        extended: true,
      }))
      https.createServer(sslOptions, app).listen(settings.local.port, () => {
        setupServer()
      })
    })
  }
} // init server

const setupServer = () => {
  if (globalSettings.serverType === 'INCOMING') {
    IncomingServer.init()
    apiInit()
  } else if (globalSettings.serverType === 'OUTGOING') {
    OutgoingServer.init()
    apiInit()
  }
}

const apiInit = () => {
  app.get('/', (req, res) => {
    md5File('dist/navtech.js', (err, hash) => {
      if (err) {
        res.send(JSON.stringify({
          status: 200,
          type: 'FAILURE',
          message: 'error generating md5 hash',
          serverType: globalSettings.serverType,
          error: err,
        }))
        return
      }
      res.send(JSON.stringify({
        status: 200,
        type: 'SUCCESS',
        message: 'server is running!',
        serverType: globalSettings.serverType,
        anonhash: hash,
      }))
    })
  })

  app.post('/api/test-decryption', (req, res) => {
    NavtechApi.runtime = {}
    NavtechApi.runtime.req = req
    NavtechApi.runtime.res = res
    if (!req.body || !req.body.encrypted_data) {
      Logger.writeLog('APP_004', 'failed to receive params', { body: req.body })
      NavtechApi.runtime.res.send(JSON.stringify({
        status: 200,
        type: 'FAIL',
        code: 'APP_004',
        message: 'failed to receive params',
      }))
      return
    }
    EncryptedData.decryptData({
      encryptedData: NavtechApi.runtime.req.body.encrypted_data,
    }, NavtechApi.checkDecrypted)
  })

  NavtechApi.checkDecrypted = (success, data) => {
    if (!success || !data || !data.decrypted) {
      Logger.writeLog('APP_005', 'unable to derypt the data', { success, data, body: NavtechApi.runtime.req.body })
      NavtechApi.runtime.res.send(JSON.stringify({
        status: 200,
        type: 'FAIL',
        code: 'APP_005',
        message: 'ERROR: unable to decrypt the data',
      }))
      return
    }
    NavtechApi.runtime.res.send(JSON.stringify({
      status: 200,
      type: 'SUCCESS',
      message: 'decryption test successful',
    }))
  }

  // ----------- GET NAV ADDRESSES ---------------------------------------------------------------------------------------------------------

  app.post('/api/get-addresses', (req, res) => {
    NavtechApi.runtime = {}
    NavtechApi.runtime.req = req
    NavtechApi.runtime.res = res

    if (!NavtechApi.runtime.req.body ||
      !NavtechApi.runtime.req.body.num_addresses ||
      !NavtechApi.runtime.req.body.type ||
      !NavtechApi.runtime.req.body.account) {
      Logger.writeLog('APP_006', 'failed to receive params', { body: req.body })
      NavtechApi.runtime.res.send(JSON.stringify({
        status: 200,
        type: 'FAIL',
        code: 'APP_006',
        message: 'ERROR: invalid params',
        body: NavtechApi.runtime.req.body,
      }))
      return
    }

    NavtechApi.runtime.accountToUse = privateSettings.account[NavtechApi.runtime.req.body.account]

    if (!NavtechApi.runtime.accountToUse) {
      NavtechApi.runtime.res.send(JSON.stringify({
        status: 200,
        type: 'FAIL',
        code: 'APP_006A',
        message: 'ERROR: invalid account',
        body: NavtechApi.runtime.req.body,
      }))
    }

    if (globalSettings.serverType === 'OUTGOING') {
      NavtechApi.checkIpAddress({ allowedIps: settings.remote }, NavtechApi.getAddresses)
      return
    }
    NavtechApi.getAddresses()
  })

  NavtechApi.getAddresses = () => {
    NavtechApi.runtime.numAddresses = parseInt(NavtechApi.runtime.req.body.num_addresses, 10)
    if (NavtechApi.runtime.req.body.type === 'SUBCHAIN') {
      NavtechApi.runtime.clientToUse = NavtechApi.subClient
    } else {
      NavtechApi.runtime.clientToUse = NavtechApi.navClient
    }

    RandomizeTransactions.getRandomAccountAddresses({
      client: NavtechApi.runtime.clientToUse,
      accountName: NavtechApi.runtime.accountToUse,
      numAddresses: NavtechApi.runtime.numAddresses,
    }, NavtechApi.returnAddresses)
  }

  NavtechApi.returnAddresses = (success, data) => {
    if (!success || !data || !data.pickedAddresses) {
      Logger.writeLog('APP_008', 'failed to pick random addresses', { success, data })
      NavtechApi.runtime.res.send(JSON.stringify({
        status: 200,
        type: 'FAIL',
        code: 'APP_008',
        message: 'failed to pick random addresses',
      }))
      return
    }
    Logger.writeLog('APP_TEST_001', 'success get-addresses', { data })
    NavtechApi.runtime.res.send(JSON.stringify({
      status: 200,
      type: 'SUCCESS',
      data: {
        addresses: data.pickedAddresses,
      },
    }))
  }

  // ----------- GET NAV BALANCE -----------------------------------------------------------------------------------------------------------

  app.get('/api/get-nav-balance', (req, res) => {
    NavtechApi.runtime = {}
    NavtechApi.runtime.req = req
    NavtechApi.runtime.res = res

    NavtechApi.navClient.getBalance().then((navBalance) => {
      NavtechApi.runtime.res.send(JSON.stringify({
        status: 200,
        type: 'SUCCESS',
        data: {
          nav_balance: navBalance,
        },
      }))
    })
    .catch((err) => {
      Logger.writeLog('APP_009', 'failed to get the NAV balance', { error: err })
      NavtechApi.runtime.res.send(JSON.stringify({
        status: 200,
        type: 'FAIL',
        code: 'APP_009',
        message: 'failed to get the NAV balance',
      }))
    })
  })

  // ------------------ CHECK AUTHORIZED IP -------------------------------------------

  NavtechApi.checkIpAddress = (options, callback) => {
    const remoteIpAddress = NavtechApi.runtime.req.connection.remoteAddress || NavtechApi.runtime.req.socket.remoteAddress
    let authorized = false
    for (let i = 0; i < options.allowedIps.length; i++) {
      if (remoteIpAddress === options.allowedIps[i].ipAddress || remoteIpAddress === '::ffff:' + options.allowedIps[i].ipAddress) {
        authorized = true
      }
    }

    if (authorized) {
      callback()
    } else {
      Logger.writeLog('APP_025', 'unauthorized access attempt', { remoteIpAddress, remote: options.allowedIps })
      NavtechApi.runtime.res.send(JSON.stringify({
        status: 200,
        type: 'FAIL',
        code: 'APP_025',
        message: 'unauthorized access attempt',
      }))
    }
  }

  // ------------------ CHECK NODE ---------------------------------------------------------------------------------------------------------

  app.post('/api/check-node', (req, res) => {
    NavtechApi.runtime = {}
    NavtechApi.runtime.req = req
    NavtechApi.runtime.res = res


    if (!NavtechApi.runtime.req.body || !NavtechApi.runtime.req.body.num_addresses) {
      Logger.writeLog('APP_026', 'failed to receive params', { body: req.body })
      NavtechApi.runtime.res.send(JSON.stringify({
        status: 200,
        type: 'FAIL',
        code: 'APP_026',
        message: 'failed to receive params',
      }))
      return
    }

    if (globalSettings.serverType === 'INCOMING' && IncomingServer.paused
       || globalSettings.serverType === 'OUTGOING' && OutgoingServer.paused) {
      Logger.writeLog('APP_026A', 'this server is paused for manual recovery', { body: req.body })
      NavtechApi.runtime.res.send(JSON.stringify({
        status: 200,
        type: 'FAIL',
        code: 'APP_026A',
        message: 'server is not accepting transactions',
      }))
      return
    }

    NavtechApi.runtime.numAddresses = parseInt(NavtechApi.runtime.req.body.num_addresses, 10)

    if (globalSettings.serverType === 'INCOMING') {
      if (globalSettings.maintenance) {
        NavtechApi.checkIpAddress({ allowedIps: globalSettings.allowedIps }, NavtechApi.checkNavBlocks)
        return
      }
      NavtechApi.checkNavBlocks()
      return
    }
    NavtechApi.checkIpAddress({ allowedIps: settings.remote }, NavtechApi.checkNavBlocks)
    return
  })

  NavtechApi.checkNavBlocks = () => {
    NavCoin.checkBlockHeight({
      client: NavtechApi.navClient,
      blockThreshold: privateSettings.blockThreshold.checking },
    NavtechApi.navBlocksChecked)
  }

  NavtechApi.navBlocksChecked = (success, data) => {
    if (!success || !data) {
      Logger.writeLog('APP_027', 'navClient block check failed', { success, data })
      NavtechApi.runtime.res.send(JSON.stringify({
        status: 200,
        type: 'FAIL',
        code: 'APP_027',
        message: 'navClient block check failed',
      }))
      return
    }
    NavtechApi.runtime.navBalance = data.balance
    NavCoin.checkBlockHeight({
      client: NavtechApi.subClient,
      blockThreshold: privateSettings.blockThreshold.checking,
    }, NavtechApi.subBlocksChecked)
  }

  NavtechApi.subBlocksChecked = (success, data) => {
    if (!success || !data) {
      Logger.writeLog('APP_028', 'subClient block check failed', { success, data })
      NavtechApi.runtime.res.send(JSON.stringify({
        status: 200,
        type: 'FAIL',
        code: 'APP_028',
        message: 'subClient block check failed',
      }))
      return
    }
    NavtechApi.runtime.subBalance = data.balance
    NavCoin.unlockWallet({ settings, client: NavtechApi.navClient, type: 'navCoin' }, NavtechApi.unlockSubchain)
  }

  NavtechApi.unlockSubchain = (success, data) => {
    if (!success) {
      Logger.writeLog('APP_029', 'navClient failed to unlock', { success, data })
      NavtechApi.runtime.res.send(JSON.stringify({
        status: 200,
        type: 'FAIL',
        code: 'APP_029',
        message: 'navClient failed to unlock',
      }))
      return
    }
    NavCoin.unlockWallet({ settings, client: NavtechApi.subClient, type: 'subChain' }, NavtechApi.getUnspent)
  }

  NavtechApi.getUnspent = (success, data) => {
    if (!success) {
      Logger.writeLog('APP_030', 'subClient failed to unlock', { success, data })
      NavtechApi.runtime.res.send(JSON.stringify({
        status: 200,
        type: 'FAIL',
        code: 'APP_030',
        message: 'subClient failed to unlock',
      }))
      return
    }

    if (globalSettings.serverType === 'OUTGOING') {
      EncryptionKeys.getEncryptionKeys({}, NavtechApi.testKeyPair)
      return
    }

    NavtechApi.navClient.listUnspent().then((unspent) => {
      if (unspent.length < 1) {
        EncryptionKeys.getEncryptionKeys({}, NavtechApi.testKeyPair)
        return
      }
      NavCoin.filterUnspent({
        unspent,
        client: NavtechApi.navClient,
        accountName: privateSettings.account[globalSettings.serverType],
      },
      NavtechApi.processFiltered)
    }).catch((err) => {
      Logger.writeLog('APP_030A', 'failed to get unspent from the navClient', { error: err })
      NavtechApi.runtime.res.send(JSON.stringify({
        status: 200,
        type: 'FAIL',
        code: 'APP_030A',
        message: 'failed to get unspent from the navClient',
      }))
      return
    })
  }

  NavtechApi.processFiltered = (success, data) => {
    if (!success) {
      Logger.writeLog('APP_030C', 'failed to filter the unspent', { success, data })
      NavtechApi.runtime.res.send(JSON.stringify({
        status: 200,
        type: 'FAIL',
        code: 'APP_030C',
        message: 'failed to filter the unspent',
      }))
      return
    }

    let highestConf = 0

    if (data.currentPending && data.currentPending.length > 0) {
      for (const pending of data.currentPending) {
        if (pending.confirmations > highestConf) {
          highestConf = pending.confirmations
        }
      }
      if (highestConf > 60) {
        Logger.writeLog('APP_030B', 'the queue is too long', { highestConf }, true)
        NavtechApi.runtime.res.send(JSON.stringify({
          status: 200,
          type: 'FAIL',
          code: 'APP_030B',
          message: 'the queue is too long',
        }))
        return
      }
    }
    EncryptionKeys.getEncryptionKeys({}, NavtechApi.testKeyPair)
  }


  NavtechApi.testKeyPair = (success, data) => {
    if (!success || !data || !data.privKeyFile || !data.pubKeyFile) {
      Logger.writeLog('APP_031', 'failed to get the current keys', { success, data })
      NavtechApi.runtime.res.send(JSON.stringify({
        status: 200,
        type: 'FAIL',
        code: 'APP_031',
        message: 'failed to get the current keys',
      }))
      return
    }

    EncryptionKeys.testKeyPair({
      pubKeyFile: data.pubKeyFile,
      privKeyFile: data.privKeyFile,
    }, NavtechApi.testedKeypair)
  }

  NavtechApi.testedKeypair = (success, data) => {
    if (!success || !data || !data.publicKey) {
      Logger.writeLog('APP_032', 'failed to encrypt with selected keypair', { success, data })
      NavtechApi.runtime.res.send(JSON.stringify({
        status: 200,
        type: 'FAIL',
        code: 'APP_032',
        message: 'failed to encrypt with selected keypair',
      }))
      return
    }

    NavtechApi.runtime.publicKey = data.publicKey
    RandomizeTransactions.getRandomAccountAddresses({
      client: NavtechApi.navClient,
      accountName: privateSettings.account[globalSettings.serverType],
      numAddresses: NavtechApi.runtime.numAddresses,
    }, NavtechApi.hasRandomAddresses)
  }

  NavtechApi.hasRandomAddresses = (success, data) => {
    if (!success || !data || !data.pickedAddresses) {
      Logger.writeLog('APP_033', 'failed to retrieve nav addresses', { success, data })
      NavtechApi.runtime.res.send(JSON.stringify({
        status: 200,
        type: 'FAIL',
        code: 'APP_033',
        message: 'failed to retrieve nav addresses',
      }))
      return
    }

    NavtechApi.runtime.navAddresses = data.pickedAddresses
    NavtechApi.getHash()
  }

  NavtechApi.hasRandomSubAddresses = (success, data) => {
    if (!success || !data || !data.pickedAddresses) {
      Logger.writeLog('APP_034', 'failed to retrieve subchain addresses', { success, data })
      NavtechApi.runtime.res.send(JSON.stringify({
        status: 200,
        type: 'FAIL',
        code: 'APP_034',
        message: 'failed to retrieve subchain addresses',
      }))
      return
    }
    NavtechApi.runtime.subAddresses = data.pickedAddresses
    NavtechApi.getHash()
  }

  NavtechApi.getHash = () => {
    md5File('dist/navtech.js', (err, hash) => {
      if (err) {
        Logger.writeLog('APP_035A', 'error generating md5 hash', { err, hash })
        NavtechApi.runtime.res.send(JSON.stringify({
          status: 200,
          type: 'FAILURE',
          message: 'error generating md5 hash',
          serverType: globalSettings.serverType,
          error: err,
        }))
        return
      }
      NavtechApi.returnCheckedNode(hash)
    })
  }

  NavtechApi.returnCheckedNode = (hash) => {
    const localHost = settings.local.host ? settings.local.host : settings.local.ipAddress

    const returnData = {
      nav_balance: NavtechApi.runtime.navBalance,
      sub_balance: NavtechApi.runtime.subBalance,
      public_key: NavtechApi.runtime.publicKey,
      server_type: globalSettings.serverType,
      min_amount: settings.minAmount,
      max_amount: settings.maxAmount,
      transaction_fee: settings.anonFeePercent,
      server: localHost,
      server_port: settings.local.port ? settings.local.port : 443,
      md5: hash,
    }

    returnData.nav_addresses = NavtechApi.runtime.navAddresses

    Logger.writeLog('APP_TEST_002', 'success check-node', { returnData })

    NavtechApi.runtime.res.send(JSON.stringify({
      status: 200,
      type: 'SUCCESS',
      data: returnData,
    }))
  }

  // @TODO check if server paused before returning as valid incoming server

  // -------------- CHECK IF SERVER IS PROCESSING ------------------------------------------------------------------------------------------

  app.get('/api/status', (req, res) => {
    NavtechApi.runtime = {}
    NavtechApi.runtime.req = req
    NavtechApi.runtime.res = res

    if (globalSettings.serverType === 'INCOMING') {
      const now = new Date()
      const diff = now - IncomingServer.runtime.cycleStart
      const timeRemaining = settings.scriptInterval - diff

      NavtechApi.runtime.res.send(JSON.stringify({
        status: 200,
        type: 'SUCCESS',
        data: {
          processing: IncomingServer.processing,
          paused: IncomingServer.paused,
          nextCycleStart: Math.round(timeRemaining / 1000) + ' seconds',
        },
      }))
    } else if (globalSettings.serverType === 'OUTGOING') {
      const now = new Date()
      const diff = now - OutgoingServer.runtime.cycleStart
      const timeRemaining = settings.scriptInterval - diff

      NavtechApi.runtime.res.send(JSON.stringify({
        status: 200,
        type: 'SUCCESS',
        data: {
          processing: OutgoingServer.processing,
          paused: OutgoingServer.paused,
          nextCycleStart: Math.round(timeRemaining / 1000) + ' seconds',
        },
      }))
    }
  })
} // apiInit
